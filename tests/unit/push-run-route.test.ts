// @vitest-environment node
import { createECDH, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 040, T4: POST /api/push/run, woken up by pg_cron (RF-2, RF-10, RF-11,
// RF-16). The secret opens it; fetch to the push services is simulated.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

import { maxDuration, POST } from "@/app/api/push/run/route";

const SECRET = "test-cron-secret";
const browser = createECDH("prime256v1");
browser.generateKeys();
const vapid = createECDH("prime256v1");
vapid.generateKeys();

function subscription(id: string, user: string) {
  return {
    id,
    user_id: user,
    endpoint: `https://push.example.test/${id}`,
    p256dh: browser.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

const soon = () => new Date(Date.now() + 10 * 60_000).toISOString();

function database({
  reminders = [] as unknown[],
  notices = [] as unknown[],
  subs = [] as unknown[],
} = {}) {
  rpc.mockImplementation(async (name: string, args: { p_keys?: unknown }) => {
    switch (name) {
      case "push_due_reminders":
        return { data: reminders, error: null };
      case "push_mark_sent":
        return { data: args.p_keys, error: null };
      case "push_claim_notifications":
        return { data: notices, error: null };
      case "push_subscriptions_for":
        return { data: subs, error: null };
      default:
        return { data: null, error: null };
    }
  });
}

function call(authorization?: string) {
  return POST(
    new Request("http://localhost/api/push/run", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    }),
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv(
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    vapid.getPublicKey().toString("base64url"),
  );
  vi.stubEnv("VAPID_PRIVATE_KEY", vapid.getPrivateKey().toString("base64url"));
  vi.stubEnv("VAPID_SUBJECT", "mailto:avisos@cafam.test");
  rpc.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/push/run", () => {
  it("lasts up to 60 s and answers 401 without the secret", async () => {
    expect(maxDuration).toBe(60);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends the due reminders, encrypted and signed, once", async () => {
    const start = soon();
    database({
      reminders: [
        {
          user_id: "u1",
          event_id: "e1",
          title: "Cena",
          location: null,
          starts_at: start,
          ends_at: start,
          all_day: false,
          recurrence: null,
          recurrence_tz: null,
          exdates: [],
          series_id: null,
          exceptions: [],
          minutes: [10],
          time_zone: "Europe/Madrid",
        },
      ],
      subs: [subscription("s1", "u1")],
    });

    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, sent: 1 });

    const marked = rpc.mock.calls.find(([n]) => n === "push_mark_sent");
    expect(marked?.[1]).toMatchObject({
      p_secret: SECRET,
      p_keys: [{ user_id: "u1", event_id: "e1", minutes: 10 }],
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://push.example.test/s1");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(init.headers.TTL).toBeDefined();
    expect(init.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(Buffer.from(init.body).length).toBeGreaterThan(86);
  });

  it("sends nothing already marked as sent by another run (RF-10)", async () => {
    const start = soon();
    database({
      reminders: [
        {
          user_id: "u1",
          event_id: "e1",
          title: "Cena",
          location: null,
          starts_at: start,
          ends_at: start,
          all_day: false,
          recurrence: null,
          recurrence_tz: null,
          exdates: [],
          series_id: null,
          exceptions: [],
          minutes: [10],
          time_zone: "Europe/Madrid",
        },
      ],
      subs: [subscription("s1", "u1")],
    });
    const base = rpc.getMockImplementation()!;
    rpc.mockImplementation(async (name: string, args: never) =>
      name === "push_mark_sent" ? { data: [], error: null } : base(name, args),
    );
    await call(`Bearer ${SECRET}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops gone subscriptions and goes on after a failure", async () => {
    database({
      notices: [
        {
          id: "n1",
          user_id: "u2",
          kind: "comment",
          payload: {
            kind: "comment",
            actor: "Ana",
            title: "Cena",
            eventId: "e1",
            body: "Hola",
          },
        },
      ],
      subs: [
        subscription("gone", "u2"),
        subscription("broken", "u2"),
        subscription("ok", "u2"),
      ],
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/gone")) return new Response(null, { status: 410 });
      if (url.endsWith("/broken")) throw new Error("network");
      return new Response(null, { status: 201 });
    });

    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toMatchObject({ ok: true, sent: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const dropped = rpc.mock.calls.find(
      ([n]) => n === "push_drop_subscription",
    );
    expect(dropped?.[1]).toMatchObject({ p_ids: ["gone"] });
    const touched = rpc.mock.calls.find(
      ([n]) => n === "push_touch_subscription",
    );
    expect(touched?.[1]).toMatchObject({ p_ids: ["ok"] });
  });

  it("answers 500 without VAPID keys", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    database();
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
