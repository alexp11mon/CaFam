// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BYTES } from "@/lib/ics/limits";

const httpsCalls = vi.hoisted(() => ({
  options: [] as Record<string, unknown>[],
  respond: null as null | ((req: EventEmitter) => void),
}));

// The default transport is checked through a fake node:https; no real network.
vi.mock("node:https", () => ({
  request: (
    options: Record<string, unknown>,
    onResponse: (res: EventEmitter) => void,
  ) => {
    httpsCalls.options.push(options);
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      const res = Object.assign(new EventEmitter(), {
        statusCode: 200,
        headers: {},
        destroy: () => {},
        async *[Symbol.asyncIterator]() {
          yield Buffer.from("BEGIN:VCALENDAR\nEND:VCALENDAR");
        },
      });
      onResponse(res);
    };
    return req;
  },
}));

const { createGuardedLookup, fetchIcs, guardedLookup } =
  await import("@/lib/ics/fetch-ics");

type Transport = NonNullable<Parameters<typeof fetchIcs>[1]>["request"];
type Response = Awaited<ReturnType<NonNullable<Transport>>>;

const URL_OK = new URL("https://calendar.example.com/a.ics");

function bodyOf(...chunks: (string | Uint8Array)[]): AsyncIterable<Uint8Array> {
  return (async function* () {
    for (const chunk of chunks) {
      yield typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    }
  })();
}

function response(status: number, init: Partial<Response> = {}): Response {
  return {
    status,
    location: undefined,
    body: bodyOf(""),
    destroy: () => {},
    ...init,
  };
}

beforeEach(() => {
  httpsCalls.options = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchIcs (RF-1, RF-4, RF-5, RF-26)", () => {
  it("returns the text of a 200 response, joining the chunks (RF-1)", async () => {
    const request = vi.fn(async () =>
      response(200, { body: bodyOf("BEGIN:VCAL", "ENDAR\r\n") }),
    );

    const result = await fetchIcs(URL_OK, { request });

    expect(result).toEqual({ ok: true, text: "BEGIN:VCALENDAR\r\n" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("decodes UTF-8 and drops the byte order mark", async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("SUMMARY:Cumpleaños ñ"),
    ]);

    const result = await fetchIcs(URL_OK, {
      request: async () => response(200, { body: bodyOf(bytes) }),
    });

    expect(result).toEqual({ ok: true, text: "SUMMARY:Cumpleaños ñ" });
  });

  it("follows up to 3 redirects, validating each one (RF-4)", async () => {
    const seen: string[] = [];
    const request = vi.fn(async (url: URL) => {
      seen.push(url.href);
      if (url.pathname === "/a.ics") {
        return response(302, { location: "/b.ics" });
      }
      if (url.pathname === "/b.ics") {
        return response(301, { location: "https://cdn.example.com/c.ics" });
      }
      if (url.pathname === "/c.ics") {
        return response(307, { location: "https://cdn.example.com/d.ics" });
      }
      return response(200, { body: bodyOf("OK") });
    });

    const result = await fetchIcs(URL_OK, { request });

    expect(result).toEqual({ ok: true, text: "OK" });
    expect(seen).toEqual([
      "https://calendar.example.com/a.ics",
      "https://calendar.example.com/b.ics",
      "https://cdn.example.com/c.ics",
      "https://cdn.example.com/d.ics",
    ]);
  });

  it("fails on the fourth redirect", async () => {
    const request = vi.fn(async (url: URL) =>
      response(302, { location: `${url.pathname}x` }),
    );

    const result = await fetchIcs(URL_OK, { request });

    expect(result).toEqual({ ok: false, error: "unreachable" });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it.each([
    "http://calendar.example.com/a.ics",
    "https://calendar.example.com:8443/a.ics",
    "https://10.0.0.1/a.ics",
    "https://169.254.169.254/latest/meta-data",
    "ftp://calendar.example.com/a.ics",
  ])("rejects a redirect to %s (RF-4)", async (location) => {
    const request = vi.fn(async () => response(302, { location }));

    const result = await fetchIcs(URL_OK, { request });

    expect(result).toEqual({ ok: false, error: "invalid-url" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("treats a redirect without location as unreachable", async () => {
    const result = await fetchIcs(URL_OK, {
      request: async () => response(302),
    });

    expect(result).toEqual({ ok: false, error: "unreachable" });
  });

  it("maps a blocked address to an invalid link (RF-4)", async () => {
    const result = await fetchIcs(URL_OK, {
      request: async () => {
        throw Object.assign(new Error("blocked"), {
          code: "ICS_BLOCKED_ADDRESS",
        });
      },
    });

    expect(result).toEqual({ ok: false, error: "invalid-url" });
  });

  it.each([404, 403, 500, 503])(
    "maps a %i response to unreachable (RF-5)",
    async (status) => {
      const result = await fetchIcs(URL_OK, {
        request: async () => response(status),
      });

      expect(result).toEqual({ ok: false, error: "unreachable" });
    },
  );

  it("maps a network failure to unreachable (RF-5)", async () => {
    const result = await fetchIcs(URL_OK, {
      request: async () => {
        throw new Error("ECONNRESET");
      },
    });

    expect(result).toEqual({ ok: false, error: "unreachable" });
  });

  it("gives up after 15 seconds (RF-5)", async () => {
    vi.useFakeTimers();
    const request = vi.fn(() => new Promise<Response>(() => {}));

    const pending = fetchIcs(URL_OK, { request });
    await vi.advanceTimersByTimeAsync(14_999);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);

    expect(await pending).toEqual({ ok: false, error: "unreachable" });
  });

  it("stops reading as soon as the body passes 2 MB (RF-26)", async () => {
    let read = 0;
    let destroyed = false;
    const chunk = Buffer.alloc(512 * 1024, 65);
    const body = (async function* () {
      for (let i = 0; i < 1000; i++) {
        read++;
        yield chunk;
      }
    })();

    const result = await fetchIcs(URL_OK, {
      request: async () =>
        response(200, { body, destroy: () => (destroyed = true) }),
    });

    expect(result).toEqual({ ok: false, error: "too-large" });
    expect(read).toBe(MAX_BYTES / chunk.length + 1);
    expect(destroyed).toBe(true);
  });

  it("accepts a body of exactly 2 MB", async () => {
    const result = await fetchIcs(URL_OK, {
      request: async () =>
        response(200, { body: bodyOf(Buffer.alloc(MAX_BYTES, 65)) }),
    });

    expect(result.ok).toBe(true);
  });

  it("never puts the link in the result (RF-6)", async () => {
    const secret = new URL(
      "https://calendar.example.com/private/SECRET-TOKEN.ics",
    );
    const failures = [
      await fetchIcs(secret, { request: async () => response(500) }),
      await fetchIcs(secret, {
        request: async () => {
          throw new Error(`failed ${secret.href}`);
        },
      }),
    ];

    expect(JSON.stringify(failures)).not.toContain("SECRET-TOKEN");
  });
});

describe("default transport (plan D6)", () => {
  it("connects over https on port 443 with the guarded lookup", async () => {
    const result = await fetchIcs(new URL("https://example.com/a/b.ics?x=1"));

    expect(result).toEqual({
      ok: true,
      text: "BEGIN:VCALENDAR\nEND:VCALENDAR",
    });
    const options = httpsCalls.options[0];
    expect(options).toMatchObject({
      hostname: "example.com",
      port: 443,
      path: "/a/b.ics?x=1",
      method: "GET",
    });
    expect(options.lookup).toBe(guardedLookup);
  });
});

describe("guarded lookup (RF-4, plan D6)", () => {
  type Address = { address: string; family: number };
  function dns(addresses: Address[], error: Error | null = null) {
    return (
      _hostname: string,
      _options: unknown,
      callback: (err: Error | null, result?: Address[]) => void,
    ) => callback(error, error ? undefined : addresses);
  }

  function run(
    lookup: ReturnType<typeof createGuardedLookup>,
    options: { all?: boolean } = {},
  ) {
    return new Promise<{
      error: (Error & { code?: string }) | null;
      result: unknown;
    }>((resolve) => {
      (
        lookup as unknown as (
          h: string,
          o: unknown,
          cb: (e: Error | null, ...rest: unknown[]) => void,
        ) => void
      )("example.com", options, (error, ...rest) =>
        resolve({ error, result: rest }),
      );
    });
  }

  it("passes public addresses through, as a list when asked with all", async () => {
    const lookup = createGuardedLookup(
      dns([{ address: "93.184.216.34", family: 4 }]),
    );

    expect((await run(lookup, { all: true })).result).toEqual([
      [{ address: "93.184.216.34", family: 4 }],
    ]);
    expect((await run(lookup)).result).toEqual(["93.184.216.34", 4]);
  });

  it.each(["10.0.0.5", "127.0.0.1", "169.254.169.254", "::1", "fd00::1"])(
    "blocks a name that resolves to %s",
    async (address) => {
      const lookup = createGuardedLookup(
        dns([{ address, family: address.includes(":") ? 6 : 4 }]),
      );

      const { error } = await run(lookup, { all: true });

      expect(error?.code).toBe("ICS_BLOCKED_ADDRESS");
    },
  );

  it("blocks when any of several addresses is private", async () => {
    const lookup = createGuardedLookup(
      dns([
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ]),
    );

    expect((await run(lookup, { all: true })).error?.code).toBe(
      "ICS_BLOCKED_ADDRESS",
    );
  });

  it("passes DNS errors through", async () => {
    const lookup = createGuardedLookup(dns([], new Error("ENOTFOUND")));

    expect((await run(lookup)).error?.message).toBe("ENOTFOUND");
  });
});
