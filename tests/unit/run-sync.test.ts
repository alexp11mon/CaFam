// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  needsFullRead,
  runDue,
  syncCalendars,
  type SyncDeps,
} from "@/lib/sync/run-sync";
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

// Spec 018, T10: an iCloud calendar goes through the same engine (plan D1,
// D3, D11; RF-15, RF-29 to RF-32, RF-61, RF-63).
describe("syncCalendars with iCloud", () => {
  const CALENDAR_URL = "https://p42-caldav.icloud.com/123/calendars/home/";
  const CREDENTIAL = JSON.stringify({
    v: 1,
    username: "ana@icloud.com",
    password: "abcd-efgh-ijkl-mnop",
  });
  const XML = { "Content-Type": "application/xml" };
  const ICS = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:one",
    "DTSTAMP:20261001T000000Z",
    "SUMMARY:Dentista",
    "DTSTART:20261105T090000Z",
    "DTEND:20261105T100000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const icloud = {
    calendar_id: "cal-i",
    connection_id: "conn-i",
    provider: "icloud",
    external_id: CALENDAR_URL,
  };

  function server(status = 207) {
    return vi.fn<typeof fetch>(async (input, init) => {
      const method = init?.method ?? "GET";
      if (status !== 207) return new Response("", { status });
      if (String(input).startsWith(CALENDAR_URL) && method === "PROPFIND") {
        return new Response(
          `<multistatus xmlns="DAV:"><response><href>/123/calendars/home/</href><propstat><prop><resourcetype><collection/></resourcetype><current-user-privilege-set><privilege><write/></privilege></current-user-privilege-set></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`,
          { status: 207, headers: XML },
        );
      }
      return new Response(
        `<multistatus xmlns="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><response><href>/123/calendars/home/one.ics</href><propstat><prop><getetag>"e1"</getetag><C:calendar-data>${ICS}</C:calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`,
        { status: 207, headers: XML },
      );
    });
  }

  beforeEach(() => {
    handlers.sync_get_token = (args) =>
      args.p_connection_id === "conn-i" ? CREDENTIAL : "rt";
  });

  it("reads with the stored credential, without renewing any token, and applies", async () => {
    fetchFn = server();

    const [result] = await syncCalendars([icloud], deps());

    expect(result).toEqual({
      calendarId: "cal-i",
      summary: { added: 1, changed: 0, removed: 0 },
    });
    expect(fetchFn.mock.calls.map(([url]) => String(url))).not.toContain(
      TOKEN_URL,
    );
    expect(named("sync_apply_events")[0].args).toMatchObject({
      p_calendar_id: "cal-i",
      p_access: "owner",
      p_skipped: 0,
      p_read_at: "2026-10-27T12:00:00.000Z",
      p_events: [
        {
          external_id: "/123/calendars/home/one.ics",
          title: "Dentista",
          starts_at: "2026-11-05T09:00:00.000Z",
        },
      ],
    });
  });

  it("a refused password stops the updates as a withdrawn permission (RF-61)", async () => {
    fetchFn = server(401);
    const [result] = await syncCalendars([icloud], deps());
    expect(result).toEqual({ calendarId: "cal-i", error: "revoked" });
    expect(named("sync_fail")[0].args).toMatchObject({ p_kind: "revoked" });
  });

  it("iCloud not answering is retried later (RF-63)", async () => {
    fetchFn = server(503);
    const [result] = await syncCalendars([icloud], deps());
    expect(result).toEqual({ calendarId: "cal-i", error: "transient" });
  });

  it("updates Google and iCloud calendars in the same run", async () => {
    const icloudServer = server();
    fetchFn = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      if (String(input).startsWith("https://www.googleapis.com/")) {
        return json({ items: [googleEvent("e1")] });
      }
      return icloudServer(input, init);
    });

    const results = await syncCalendars([calendar(1), icloud], deps());

    expect(results.every((r) => "summary" in r)).toBe(true);
    expect(named("sync_apply_events")).toHaveLength(2);
  });
});

// Spec 020, T9: the version check before reading (plan D9, D12; RF-23, RF-26
// to RF-30).
describe("needsFullRead", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const base = {
    version: "v1",
    stored: "v1",
    pushPending: false,
    fullReadAt: "2026-11-08T09:00:00Z",
    now,
  };

  it("skips the read when nothing says it changed", () => {
    expect(needsFullRead(base)).toBe(false);
  });

  it.each([
    ["another version", { version: "v2" }],
    ["no stored version", { stored: null }],
    ["no version from the provider", { version: null }],
    ["a Google notice", { pushPending: true }],
    ["never read in full", { fullReadAt: null }],
    ["read in full over 6 h ago", { fullReadAt: "2026-11-08T05:59:00Z" }],
  ])("reads everything with %s", (_, change) => {
    expect(needsFullRead({ ...base, ...change })).toBe(true);
  });
});

describe("syncCalendars with the version check", () => {
  const VERSION_FIELDS = "updated";
  const checked = (extra = {}) => ({
    ...calendar(1),
    remote_version: "2026-11-08T10:00:00Z",
    full_read_at: "2026-10-27T10:00:00Z",
    push_pending_at: null,
    ...extra,
  });

  function google(version: string | null) {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      const url = new URL(String(input));
      if (url.searchParams.get("fields") === VERSION_FIELDS) {
        return json(version ? { updated: version } : {});
      }
      return json({ items: [googleEvent("e1")] });
    });
  }
  const reads = () =>
    fetchFn.mock.calls.filter(([u]) =>
      new URL(String(u)).searchParams.has("singleEvents"),
    );

  it("same version, no notice and a recent full read: only marks it checked", async () => {
    google("2026-11-08T10:00:00Z");
    const [result] = await syncCalendars([checked()], deps());

    expect(reads()).toHaveLength(0);
    expect(named("sync_apply_events")).toHaveLength(0);
    expect(named("sync_mark_checked")[0].args).toEqual({
      p_secret: "s3cret",
      p_calendar_id: "cal-1",
      p_version: "2026-11-08T10:00:00Z",
      p_full: false,
    });
    expect(result).toEqual({
      calendarId: "cal-1",
      summary: { added: 0, changed: 0, removed: 0 },
    });
  });

  it.each([
    ["another version", {}, "2026-11-08T11:00:00Z"],
    ["no stored version", { remote_version: null }, "2026-11-08T10:00:00Z"],
    [
      "a notice",
      { push_pending_at: "2026-10-27T11:59:00Z" },
      "2026-11-08T10:00:00Z",
    ],
    [
      "a full read over 6 h ago",
      { full_read_at: "2026-10-27T05:00:00Z" },
      "2026-11-08T10:00:00Z",
    ],
  ])(
    "%s: reads everything and stores the version",
    async (_, extra, version) => {
      google(version);
      await syncCalendars([checked(extra)], deps());

      expect(reads()).toHaveLength(1);
      const order = calls.map((c) => c.fn);
      expect(order.indexOf("sync_apply_events")).toBeLessThan(
        order.indexOf("sync_mark_checked"),
      );
      expect(named("sync_mark_checked")[0].args).toEqual({
        p_secret: "s3cret",
        p_calendar_id: "cal-1",
        p_version: version,
        p_full: true,
      });
    },
  );

  it("asks for the version before reading", async () => {
    google("2026-11-08T11:00:00Z");
    await syncCalendars([checked()], deps());
    const urls = fetchFn.mock.calls
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.origin === "https://www.googleapis.com");
    expect(urls[0].searchParams.get("fields")).toBe(VERSION_FIELDS);
    expect(urls[1].searchParams.get("singleEvents")).toBe("true");
  });

  it("a failure asking for the version goes to sync_fail with its kind", async () => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      return json({}, 404);
    });
    const [result] = await syncCalendars([checked()], deps());

    expect(reads()).toHaveLength(0);
    expect(named("sync_mark_checked")).toHaveLength(0);
    expect(named("sync_fail")[0].args).toMatchObject({ p_kind: "missing" });
    expect(result).toEqual({ calendarId: "cal-1", error: "missing" });
  });
});

// Spec 020, T10: channels renewed in the engine pass and the stops queue
// (plan D8, D11; RF-20, RF-22).
describe("Google channels in the engine", () => {
  const PUSH = "https://cafam.test/api/sync/google-push";
  const claimed = (expires: string | null, provider = "google") => ({
    ...calendar(1),
    provider,
    remote_version: null,
    full_read_at: null,
    push_pending_at: null,
    channel_expires_at: expires,
  });
  const watches = () =>
    fetchFn.mock.calls.filter(([u]) => String(u).endsWith("/events/watch"));

  beforeEach(() => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      if (String(input).endsWith("/events/watch")) {
        return json({ resourceId: "res-new", expiration: "1794821623000" });
      }
      if (String(input).endsWith("/channels/stop")) {
        return new Response(null, { status: 204 });
      }
      return json({ items: [] });
    });
  });

  it.each([
    ["without a channel", null],
    ["with a channel expiring in 23 h", "2026-10-28T11:00:00Z"],
  ])("%s: watches and stores the channel", async (_, expires) => {
    await syncCalendars([claimed(expires)], deps({ pushUrl: PUSH }));

    expect(watches()).toHaveLength(1);
    const body = JSON.parse(String(watches()[0][1]!.body));
    expect(body.address).toBe(PUSH);
    expect(named("sync_store_channel")[0].args).toEqual({
      p_secret: "s3cret",
      p_calendar_id: "cal-1",
      p_channel_id: body.id,
      p_resource_id: "res-new",
      p_token: body.token,
      p_expires_at: new Date(1794821623000).toISOString(),
    });
  });

  it("leaves a channel with more than 24 h alone", async () => {
    await syncCalendars(
      [claimed("2026-10-29T13:00:00Z")],
      deps({ pushUrl: PUSH }),
    );
    expect(watches()).toHaveLength(0);
    expect(named("sync_store_channel")).toHaveLength(0);
  });

  it("creates no channel without SYNC_PUSH_URL, nor in a manual claim", async () => {
    await syncCalendars([claimed(null)], deps());
    await syncCalendars([calendar(2)], deps({ pushUrl: PUSH }));
    expect(watches()).toHaveLength(0);
  });

  it("iCloud never creates channels", async () => {
    handlers.sync_get_token = () =>
      JSON.stringify({ v: 1, username: "a@icloud.com", password: "p" });
    await syncCalendars(
      [
        {
          ...claimed(null, "icloud"),
          external_id: "https://p1-caldav.icloud.com/1/calendars/home/",
        },
      ],
      deps({ pushUrl: PUSH }),
    );
    expect(watches()).toHaveLength(0);
    expect(named("sync_store_channel")).toHaveLength(0);
  });

  it("a failed watch does not fail the update", async () => {
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      if (String(input).endsWith("/events/watch")) return json({}, 403);
      return json({ items: [] });
    });
    const [result] = await syncCalendars(
      [claimed(null)],
      deps({ pushUrl: PUSH }),
    );
    expect(result).toMatchObject({ calendarId: "cal-1", summary: {} });
    expect(named("sync_fail")).toHaveLength(0);
  });

  it("runDue stops the queued channels and marks them done, even when stop fails", async () => {
    handlers.sync_claim_due = () => [];
    handlers.sync_claim_stops = () => [
      {
        channel_id: "ch-a",
        resource_id: "res-a",
        connection_id: "conn-1",
        provider: "google",
      },
      {
        channel_id: "ch-b",
        resource_id: "res-b",
        connection_id: "conn-1",
        provider: "google",
      },
    ];
    let first = true;
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      if (String(input).endsWith("/channels/stop")) {
        if (first) {
          first = false;
          return json({}, 503);
        }
        return new Response(null, { status: 204 });
      }
      return json({ items: [] });
    });

    await expect(runDue(deps())).resolves.toBe(0);

    const stopCalls = fetchFn.mock.calls.filter(([u]) =>
      String(u).endsWith("/channels/stop"),
    );
    expect(stopCalls.map(([, init]) => JSON.parse(String(init!.body)))).toEqual(
      [
        { id: "ch-a", resourceId: "res-a" },
        { id: "ch-b", resourceId: "res-b" },
      ],
    );
    expect(named("sync_done_stop").map((c) => c.args.p_channel_id)).toEqual([
      "ch-a",
      "ch-b",
    ]);
  });

  it("the channel token never reaches a log", async () => {
    const spies = (["log", "warn", "error", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    fetchFn.mockImplementation(async (input) => {
      if (String(input) === TOKEN_URL) return json({ access_token: "at" });
      // Even when Google refuses the channel.
      if (String(input).endsWith("/events/watch")) return json({}, 400);
      return json({ items: [] });
    });
    await syncCalendars([claimed(null)], deps({ pushUrl: PUSH }));
    const token = JSON.parse(String(watches()[0][1]!.body)).token as string;
    for (const spy of spies) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
      spy.mockRestore();
    }
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
