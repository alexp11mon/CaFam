import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 007, T4: the sync functions and the hourly run (plan "Contratos", D2 to
// D7; RF-13, RF-22 to RF-25, RF-31, RF-33, RF-34). CRON_SECRET in
// .env.test.local must match cron_secret in the dev Vault.
const SECRET = process.env.CRON_SECRET ?? "";
if (!SECRET) throw new Error("Missing CRON_SECRET: add it to .env.test.local");

const engine = anonClient();
let owner: TestUser;
let connectionId: string;

async function newSynced(name: string, externalId: string) {
  const { data, error } = await owner.client.rpc("select_synced_calendars", {
    p_connection_id: connectionId,
    p_calendars: [{ external_id: externalId, name, color: "#A0C4FF" }],
  });
  if (error) throw error;
  return (data as { calendar_id: string }[])[0].calendar_id;
}

async function syncedRow(calendarId: string) {
  const { data } = await admin
    .from("synced_calendars")
    .select("*")
    .eq("calendar_id", calendarId)
    .single();
  return data!;
}

async function noticesOf(kind: string) {
  const { data } = await admin
    .from("account_notices")
    .select("calendar_name")
    .eq("user_id", owner.id)
    .eq("kind", kind);
  return data ?? [];
}

function event(id: string, title: string, day = "02") {
  return {
    external_id: id,
    title,
    description: null,
    location: null,
    starts_at: `2026-11-${day}T10:00:00.000Z`,
    ends_at: `2026-11-${day}T11:00:00.000Z`,
    all_day: false,
  };
}

beforeAll(async () => {
  owner = await createTestUser({ display_name: "Owner" });
  const { data, error } = await owner.client.rpc("connect_account", {
    p_provider: "google",
    p_subject: "worker",
    p_email: "worker@gmail.test",
    p_refresh_token: "rt-start",
  });
  if (error) throw error;
  connectionId = (data as { id: string }).id;
});

afterAll(async () => {
  if (owner) await deleteTestUser(owner.id);
});

describe("secret (plan D4, R2)", () => {
  it.each([
    ["sync_claim_due", { p_limit: 1 }],
    [
      "sync_claim_connection",
      {
        p_connection_id: "00000000-0000-0000-0000-000000000000",
        p_manual: true,
      },
    ],
    [
      "sync_get_token",
      { p_connection_id: "00000000-0000-0000-0000-000000000000" },
    ],
  ] as const)(
    "%s fails without the secret or with a wrong one",
    async (fn, args) => {
      const none = await engine.rpc(fn, { ...args, p_secret: "" } as never);
      const wrong = await engine.rpc(fn, {
        ...args,
        p_secret: "wrong",
      } as never);
      expect(none.error?.code).toBe("42501");
      expect(wrong.error?.code).toBe("42501");
    },
  );

  it("sync_apply_events and sync_fail fail with a wrong secret", async () => {
    const calendarId = await newSynced("Secreto", "secret-cal");
    const apply = await engine.rpc("sync_apply_events", {
      p_secret: "wrong",
      p_calendar_id: calendarId,
      p_events: [],
    });
    const fail = await engine.rpc("sync_fail", {
      p_secret: "wrong",
      p_calendar_id: calendarId,
      p_kind: "missing",
    });
    expect(apply.error?.code).toBe("42501");
    expect(fail.error?.code).toBe("42501");
  });
});

describe("tokens (D6, R3)", () => {
  it("reads and rotates the refresh token", async () => {
    const read = await engine.rpc("sync_get_token", {
      p_secret: SECRET,
      p_connection_id: connectionId,
    });
    expect(read.data).toBe("rt-start");

    await engine.rpc("sync_store_token", {
      p_secret: SECRET,
      p_connection_id: connectionId,
      p_token: "rt-rotated",
    });
    const again = await engine.rpc("sync_get_token", {
      p_secret: SECRET,
      p_connection_id: connectionId,
    });
    expect(again.data).toBe("rt-rotated");
  });
});

describe("sync_apply_events (RF-23, RF-25)", () => {
  let calendarId: string;

  beforeAll(async () => {
    calendarId = await newSynced("Aplicar", "apply-cal");
  });

  async function apply(events: object[]) {
    const { data, error } = await engine.rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_events: events as never,
      p_skipped: 1,
      p_omitted: 2,
    });
    if (error) throw error;
    return data;
  }

  async function titles() {
    const { data } = await admin
      .from("events")
      .select("external_id, title")
      .eq("calendar_id", calendarId)
      .order("external_id");
    return data ?? [];
  }

  it("inserts everything on the first load", async () => {
    const summary = await apply([
      event("a", "A"),
      event("b", "B"),
      event("c", "C"),
    ]);
    expect(summary).toEqual({
      added: 3,
      changed: 0,
      removed: 0,
      skipped: 1,
      omitted: 2,
    });
  });

  it("then changes, inserts and removes what is needed", async () => {
    const summary = await apply([
      event("a", "A"),
      event("b", "B2"),
      event("d", "D"),
    ]);
    expect(summary).toEqual({
      added: 1,
      changed: 1,
      removed: 1,
      skipped: 1,
      omitted: 2,
    });
    expect(await titles()).toEqual([
      { external_id: "a", title: "A" },
      { external_id: "b", title: "B2" },
      { external_id: "d", title: "D" },
    ]);
  });

  it("does not duplicate when repeated and keeps the summary", async () => {
    const summary = await apply([
      event("a", "A"),
      event("b", "B2"),
      event("d", "D"),
    ]);
    expect(summary).toMatchObject({ added: 0, changed: 0, removed: 0 });
    expect(await titles()).toHaveLength(3);

    const row = await syncedRow(calendarId);
    expect(row.last_summary).toEqual(summary);
    expect(row.last_synced_at).not.toBeNull();
  });
});

// Spec 009, T4: the last change wins and CaFam-only events stay (plan D5, D9;
// RF-8, RF-16, RF-27, RF-28, RF-42).
describe("sync_apply_events with writes from CaFam", () => {
  let calendarId: string;

  beforeAll(async () => {
    calendarId = await newSynced("Escritura", "write-cal");
  });

  async function apply(events: object[], extra: Record<string, unknown> = {}) {
    const { data, error } = await engine.rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_events: events as never,
      ...extra,
    });
    if (error) throw error;
    return data;
  }

  async function rowOf(externalId: string) {
    const { data } = await admin
      .from("events")
      .select("title, color, category_id, updated_at")
      .eq("calendar_id", calendarId)
      .eq("external_id", externalId)
      .maybeSingle();
    return data;
  }

  it("does not overwrite or remove what changed in CaFam after reading (RF-27)", async () => {
    await apply([event("w1", "Google"), event("w2", "Otro")]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await admin
      .from("events")
      .update({ title: "CaFam", color: "#FFADAD" })
      .eq("calendar_id", calendarId)
      .eq("external_id", "w1");
    // Database clock: the read happened just before the CaFam change.
    const changedAt = Date.parse((await rowOf("w1"))!.updated_at);
    const before = new Date(changedAt - 1).toISOString();

    await apply([event("w1", "Google viejo")], { p_read_at: before });
    expect((await rowOf("w1"))?.title).toBe("CaFam");
    // w2 was not touched after the read either, so it goes.
    expect(await rowOf("w2")).toBeNull();
  });

  it("applies a Google change read after the CaFam one (RF-28) and keeps color and category (RF-16)", async () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await apply([event("w1", "Google nuevo")], { p_read_at: later });
    const row = await rowOf("w1");
    expect(row?.title).toBe("Google nuevo");
    expect(row?.color).toBe("#FFADAD");
  });

  it("keeps an event just created in CaFam that the read did not see", async () => {
    const before = new Date(Date.now() - 3_600_000).toISOString();
    await admin.from("events").insert({
      calendar_id: calendarId,
      external_id: "fresh",
      title: "Recién creado",
      starts_at: "2026-11-05T10:00:00Z",
      ends_at: "2026-11-05T11:00:00Z",
      created_by: owner.id,
    });
    await apply([event("w1", "Google nuevo")], { p_read_at: before });
    expect((await rowOf("fresh"))?.title).toBe("Recién creado");
  });

  it("never removes events without external_id (RF-42)", async () => {
    await admin.from("events").insert({
      calendar_id: calendarId,
      title: "Solo CaFam",
      starts_at: "2020-01-01T10:00:00Z",
      ends_at: "2020-01-01T11:00:00Z",
      created_by: owner.id,
    });
    await apply([]);
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .is("external_id", null);
    expect(count).toBe(1);
  });

  it("stores the Google access (RF-8)", async () => {
    await apply([], { p_access: "reader" });
    expect((await syncedRow(calendarId)).google_access).toBe("reader");
    await apply([], { p_access: "bogus" });
    expect((await syncedRow(calendarId)).google_access).toBe("reader");
  });

  it("sync_set_access stores the access from the calendar list (RF-4)", async () => {
    const wrong = await engine.rpc("sync_set_access", {
      p_secret: "wrong",
      p_connection_id: connectionId,
      p_items: [],
    });
    expect(wrong.error?.code).toBe("42501");
    const { error } = await engine.rpc("sync_set_access", {
      p_secret: SECRET,
      p_connection_id: connectionId,
      p_items: [{ external_id: "write-cal", access: "writer" }],
    });
    expect(error).toBeNull();
    expect((await syncedRow(calendarId)).google_access).toBe("writer");
  });
});

describe("sync_fail (RF-13, RF-31, RF-33, RF-34)", () => {
  async function fail(calendarId: string, kind: string) {
    const { error } = await engine.rpc("sync_fail", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_kind: kind,
    });
    if (error) throw error;
  }

  it("transient adds a failure and notifies once at the third; success resets", async () => {
    const calendarId = await newSynced("Fallos", "fail-cal");
    for (let i = 0; i < 4; i++) await fail(calendarId, "transient");

    expect((await syncedRow(calendarId)).consecutive_failures).toBe(4);
    expect(await noticesOf("sync_failing")).toEqual([
      { calendar_name: "Fallos" },
    ]);

    await engine.rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_events: [],
    });
    expect((await syncedRow(calendarId)).consecutive_failures).toBe(0);
  });

  it("missing marks the calendar without removing its events", async () => {
    const calendarId = await newSynced("Desaparecido", "missing-cal");
    await engine.rpc("sync_apply_events", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_events: [event("m", "M")],
    });
    await fail(calendarId, "missing");

    expect((await syncedRow(calendarId)).state).toBe("missing");
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", calendarId);
    expect(count).toBe(1);
  });
});

describe("claiming (RF-22, RF-24)", () => {
  let calendarId: string;

  beforeAll(async () => {
    calendarId = await newSynced("Reclamar", "claim-cal");
  });

  it("sync_claim_due returns only due calendars and marks them", async () => {
    const old = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    await admin
      .from("synced_calendars")
      .update({ last_attempt_at: recent, sync_started_at: null })
      .eq("connection_id", connectionId);
    await admin
      .from("synced_calendars")
      .update({ last_attempt_at: old })
      .eq("calendar_id", calendarId);

    const { data } = await engine.rpc("sync_claim_due", {
      p_secret: SECRET,
      p_limit: 1000,
    });
    const mine = (data ?? []).filter((r) => r.connection_id === connectionId);
    expect(mine.map((r) => r.calendar_id)).toEqual([calendarId]);

    const row = await syncedRow(calendarId);
    expect(row.sync_started_at).not.toBeNull();

    // Already running: not claimed again.
    await admin
      .from("synced_calendars")
      .update({ last_attempt_at: old })
      .eq("calendar_id", calendarId);
    const second = await engine.rpc("sync_claim_due", {
      p_secret: SECRET,
      p_limit: 1000,
    });
    expect((second.data ?? []).map((r) => r.calendar_id)).not.toContain(
      calendarId,
    );
  });

  it("does not claim calendars of a connection that needs reauth", async () => {
    await admin
      .from("synced_calendars")
      .update({
        last_attempt_at: new Date(Date.now() - 6 * 3_600_000).toISOString(),
        sync_started_at: null,
      })
      .eq("calendar_id", calendarId);
    await admin
      .from("calendar_connections")
      .update({ status: "needs_reauth" })
      .eq("id", connectionId);

    const { data } = await engine.rpc("sync_claim_due", {
      p_secret: SECRET,
      p_limit: 1000,
    });
    expect((data ?? []).map((r) => r.calendar_id)).not.toContain(calendarId);
    await admin
      .from("calendar_connections")
      .update({ status: "active" })
      .eq("id", connectionId);
  });

  it("manual claim says too_soon within 5 minutes and claims otherwise", async () => {
    const lastSynced = new Date(Date.now() - 60_000);
    await admin
      .from("calendar_connections")
      .update({ last_synced_at: lastSynced.toISOString() })
      .eq("id", connectionId);

    const soon = await engine.rpc("sync_claim_connection", {
      p_secret: SECRET,
      p_connection_id: connectionId,
      p_manual: true,
    });
    const tooSoon = soon.data as { status: string; next_at: string };
    expect(tooSoon.status).toBe("too_soon");
    expect(Date.parse(tooSoon.next_at)).toBe(lastSynced.getTime() + 5 * 60_000);

    await admin
      .from("calendar_connections")
      .update({
        last_synced_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      })
      .eq("id", connectionId);
    await admin
      .from("synced_calendars")
      .update({ sync_started_at: null })
      .eq("connection_id", connectionId);

    const ok = await engine.rpc("sync_claim_connection", {
      p_secret: SECRET,
      p_connection_id: connectionId,
      p_manual: true,
    });
    const result = ok.data as {
      status: string;
      calendars: { calendar_id: string }[];
    };
    expect(result.status).toBe("ok");
    expect(result.calendars.map((c) => c.calendar_id)).toContain(calendarId);
  });
});

describe("revoked (RF-31)", () => {
  it("puts the connection in needs_reauth and notifies once", async () => {
    const calendarId = await newSynced("Revocado", "revoked-cal");
    for (let i = 0; i < 2; i++) {
      await engine.rpc("sync_fail", {
        p_secret: SECRET,
        p_calendar_id: calendarId,
        p_kind: "revoked",
      });
    }

    const { data } = await admin
      .from("calendar_connections")
      .select("status")
      .eq("id", connectionId)
      .single();
    expect(data?.status).toBe("needs_reauth");
    expect(await noticesOf("sync_revoked")).toEqual([
      { calendar_name: "worker@gmail.test" },
    ]);
  });
});

describe("hourly run (D2, D3)", () => {
  it("schedules sync-run-due every hour", async () => {
    const { data } = await admin.rpc("sync_scheduled_jobs");
    expect(data).toEqual([{ jobname: "sync-run-due", schedule: "0 * * * *" }]);
  });

  it("sync_trigger does nothing without due calendars", async () => {
    // Drain whatever is due in dev.
    await engine.rpc("sync_claim_due", { p_secret: SECRET, p_limit: 10_000 });
    const { data, error } = await admin.rpc("sync_trigger", {
      p_dry_run: true,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("sync_trigger posts to /api/sync/run with the secret and a 60 s timeout", async () => {
    await admin
      .from("calendar_connections")
      .update({ status: "active" })
      .eq("id", connectionId);
    const calendarId = await newSynced("Pendiente", "due-cal");
    await admin
      .from("synced_calendars")
      .update({ last_attempt_at: null, sync_started_at: null })
      .eq("calendar_id", calendarId);

    const { data } = await admin.rpc("sync_trigger", { p_dry_run: true });
    const request = data as {
      url: string;
      headers: Record<string, string>;
      timeout_milliseconds: number;
    };
    expect(request.url).toMatch(/\/api\/sync\/run$/);
    expect(request.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(request.timeout_milliseconds).toBe(60000);
  });

  it("sync_trigger is not callable by clients", async () => {
    const { error } = await owner.client.rpc("sync_trigger", {
      p_dry_run: true,
    });
    expect(error?.code).toBe("42501");
  });
});
