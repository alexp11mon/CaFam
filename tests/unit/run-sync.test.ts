// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDue, syncCalendars, type SyncDeps } from "@/lib/sync/run-sync";
import { summaryText, SYNC_ERRORS } from "@/lib/sync/summary";

// Spec 007, T8: the sync engine with fake Google and a fake rpc (plan D1, D5,
// D7, D17, D19, R3; RF-13, RF-18, RF-19, RF-22, RF-23, RF-25, RF-31, RF-33).
type Call = { fn: string; args: Record<string, unknown> };
let calls: Call[];
let handlers: Record<string, (args: Record<string, unknown>) => unknown>;

const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
  calls.push({ fn, args });
  const handler = handlers[fn];
  return handler
    ? { data: handler(args), error: null }
    : { data: null, error: null };
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
let fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;

function deps(extra: Partial<SyncDeps> = {}): SyncDeps {
  return {
    supabase: { rpc } as unknown as SyncDeps["supabase"],
    secret: "s3cret",
    fetchFn,
    clientId: "id",
    clientSecret: "secret",
    now: () => new Date("2026-10-27T12:00:00Z"),
    ...extra,
  };
}

const calendar = (n: number, connection = "conn-1") => ({
  calendar_id: `cal-${n}`,
  connection_id: connection,
  provider: "google",
  external_id: `g-${n}`,
});

const googleEvent = (id: string, start = "2026-11-02T10:00:00Z") => ({
  id,
  status: "confirmed",
  summary: id,
  start: { dateTime: start },
  end: { dateTime: start },
});

beforeEach(() => {
  calls = [];
  handlers = {
    sync_get_token: () => "rt",
    sync_apply_events: () => ({ added: 1, changed: 0, removed: 0 }),
  };
  fetchFn = vi.fn<typeof fetch>(async (input) => {
    if (String(input) === TOKEN_URL) return json({ access_token: "at" });
    return json({ items: [googleEvent("e1")] });
  });
  rpc.mockClear();
});

const named = (fn: string) => calls.filter((c) => c.fn === fn);

describe("syncCalendars", () => {
  it("renews the token, reads, converts and applies (RF-25)", async () => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      return json({
        accessRole: "owner",
        items: [
          googleEvent("ok"),
          {
            id: "bad",
            start: { dateTime: "2026-11-02T10:00:00Z" },
            end: { dateTime: "2026-11-01T10:00:00Z" },
          },
          { id: "gone", status: "cancelled" },
        ],
      });
    });

    const [result] = await syncCalendars([calendar(1)], deps());

    expect(named("sync_get_token")[0].args).toEqual({
      p_secret: "s3cret",
      p_connection_id: "conn-1",
    });
    const apply = named("sync_apply_events")[0].args;
    expect(apply).toMatchObject({
      p_secret: "s3cret",
      p_calendar_id: "cal-1",
      p_skipped: 1,
      p_omitted: 0,
      // Read time and Google access (spec 009 T4, plan D5, D10).
      p_read_at: "2026-10-27T12:00:00.000Z",
      p_access: "owner",
    });
    expect(
      (apply.p_events as { external_id: string }[]).map((e) => e.external_id),
    ).toEqual(["ok"]);
    expect(result).toEqual({
      calendarId: "cal-1",
      summary: { added: 1, changed: 0, removed: 0 },
    });
  });

  it("stores a rotated token before reading events (R3)", async () => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL)
        return json({ access_token: "at", refresh_token: "rt-new" });
      return json({ items: [] });
    });

    await syncCalendars([calendar(1)], deps());

    const order = calls.map((c) => c.fn);
    expect(order.indexOf("sync_store_token")).toBeLessThan(
      order.indexOf("sync_apply_events"),
    );
    expect(named("sync_store_token")[0].args).toMatchObject({
      p_token: "rt-new",
    });
  });

  it("renews the token once per connection", async () => {
    await syncCalendars([calendar(1), calendar(2)], deps());
    expect(
      fetchFn.mock.calls.filter(([url]) => String(url) === TOKEN_URL),
    ).toHaveLength(1);
  });

  it("keeps the 2,000 nearest events and passes how many were omitted (RF-19)", async () => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      return json({
        items: Array.from({ length: 2100 }, (_, i) => googleEvent(`e${i}`)),
      });
    });

    await syncCalendars([calendar(1)], deps());

    const apply = named("sync_apply_events")[0].args;
    expect((apply.p_events as unknown[]).length).toBe(2000);
    expect(apply.p_omitted).toBe(100);
  });

  it.each([
    [json({ error: "invalid_grant" }, 400), "token", "revoked"],
    [json({}, 503), "token", "transient"],
    [json({}, 404), "events", "missing"],
    [json({}, 429), "events", "transient"],
  ] as const)(
    "a failure keeps the data and calls sync_fail (%#)",
    async (response, where, kind) => {
      fetchFn.mockImplementation(async (input) => {
        const isToken = String(input) === TOKEN_URL;
        if ((where === "token") === isToken) return response.clone();
        return json({ access_token: "at" });
      });

      const [result] = await syncCalendars([calendar(1)], deps());

      expect(named("sync_apply_events")).toHaveLength(0);
      expect(named("sync_fail")[0].args).toEqual({
        p_secret: "s3cret",
        p_calendar_id: "cal-1",
        p_kind: kind,
      });
      expect(result).toEqual({ calendarId: "cal-1", error: kind });
    },
  );

  it("an unexpected error counts as transient", async () => {
    handlers.sync_apply_events = () => {
      throw new Error("boom");
    };

    const [result] = await syncCalendars([calendar(1)], deps());

    expect(result).toEqual({ calendarId: "cal-1", error: "transient" });
  });

  it("runs at most 4 calendars at a time", async () => {
    let running = 0;
    let peak = 0;
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return json({ items: [] });
    });

    const results = await syncCalendars(
      Array.from({ length: 10 }, (_, i) => calendar(i)),
      deps(),
    );

    expect(results).toHaveLength(10);
    expect(peak).toBe(4);
  });
});

describe("runDue (RF-22, plan D19)", () => {
  it("claims in batches of 4 until nothing is due", async () => {
    const batches = [
      [calendar(1), calendar(2), calendar(3), calendar(4)],
      [calendar(5)],
      [],
    ];
    handlers.sync_claim_due = () => batches.shift();

    expect(await runDue(deps())).toBe(5);
    expect(named("sync_claim_due").map((c) => c.args)).toEqual([
      { p_secret: "s3cret", p_limit: 4 },
      { p_secret: "s3cret", p_limit: 4 },
      { p_secret: "s3cret", p_limit: 4 },
    ]);
  });

  it("stops claiming when the 50 s budget runs out, leaving the rest unmarked", async () => {
    let clock = 0;
    handlers.sync_claim_due = () => {
      clock += 30_000;
      return [calendar(clock)];
    };

    const count = await runDue(deps({ elapsedMs: () => clock }));

    expect(count).toBe(2);
    expect(named("sync_claim_due")).toHaveLength(2);
  });
});

describe("texts", () => {
  it("summarises an update in Spanish (RF-18, RF-19, RF-23)", () => {
    expect(
      summaryText({ added: 3, changed: 1, removed: 0, skipped: 0, omitted: 0 }),
    ).toBe("3 añadidos, 1 cambiado y 0 quitados.");
    expect(
      summaryText({
        added: 1,
        changed: 0,
        removed: 2,
        skipped: 2,
        omitted: 50,
      }),
    ).toBe(
      "1 añadido, 0 cambiados y 2 quitados. 2 omitidos por no ser válidos. 50 más lejanos no se han traído por el límite de 2.000 eventos.",
    );
  });

  it("explains each failure in Spanish", () => {
    expect(Object.keys(SYNC_ERRORS).sort()).toEqual([
      "missing",
      "revoked",
      "transient",
    ]);
    expect(SYNC_ERRORS.revoked).toMatch(/vuelve a conectar/i);
  });
});
