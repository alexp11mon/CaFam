import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 020, T8: notices, channels, version check and the stops queue (plan
// "Modelo de datos", D7 to D12; RF-19 to RF-30).
const SECRET = process.env.CRON_SECRET ?? "";
if (!SECRET) throw new Error("Missing CRON_SECRET: add it to .env.test.local");

const engine = anonClient();
let owner: TestUser;
let connectionId: string;
let calendarId: string;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

async function row() {
  const { data } = await admin
    .from("synced_calendars")
    .select("*")
    .eq("calendar_id", calendarId)
    .single();
  return data!;
}

async function setRow(
  values: Database["public"]["Tables"]["synced_calendars"]["Update"],
) {
  const { error } = await admin
    .from("synced_calendars")
    .update(values)
    .eq("calendar_id", calendarId);
  if (error) throw error;
}

async function claimMine() {
  const { data, error } = await engine.rpc("sync_claim_due", {
    p_secret: SECRET,
    p_limit: 10_000,
  });
  if (error) throw error;
  return (data ?? []).filter((r) => r.calendar_id === calendarId);
}

async function storeChannel(channelId: string, token: string) {
  const { error } = await engine.rpc("sync_store_channel", {
    p_secret: SECRET,
    p_calendar_id: calendarId,
    p_channel_id: channelId,
    p_resource_id: `res-${channelId}`,
    p_token: token,
    p_expires_at: new Date(Date.now() + 7 * 24 * 60 * MIN).toISOString(),
  });
  if (error) throw error;
}

async function stops() {
  const { data } = await admin
    .from("sync_channel_stops")
    .select("channel_id, resource_id")
    .eq("connection_id", connectionId);
  return data ?? [];
}

beforeAll(async () => {
  owner = await createTestUser({ display_name: "Rápido" });
  const connected = await owner.client.rpc("connect_account", {
    p_provider: "google",
    p_subject: "fast",
    p_email: "fast@gmail.test",
    p_refresh_token: "rt-fast",
  });
  if (connected.error) throw connected.error;
  connectionId = (connected.data as { id: string }).id;
  const selected = await owner.client.rpc("select_synced_calendars", {
    p_connection_id: connectionId,
    p_calendars: [
      { external_id: "fast-cal", name: "Rápido", color: "#A0C4FF" },
    ],
  });
  if (selected.error) throw selected.error;
  calendarId = (selected.data as { calendar_id: string }[])[0].calendar_id;
});

afterAll(async () => {
  if (owner) await deleteTestUser(owner.id);
  if (connectionId) {
    await admin
      .from("sync_channel_stops")
      .delete()
      .eq("connection_id", connectionId);
  }
});

describe("tables are out of reach of clients (P4, D10)", () => {
  it("the owner cannot read channels nor stops", async () => {
    await storeChannel("ch-private", "tok-private");
    const channels = await owner.client.from("sync_channels").select("*");
    const queued = await owner.client.from("sync_channel_stops").select("*");
    expect(channels.error?.code).toBe("42501");
    expect(queued.error?.code).toBe("42501");
  });

  it("stores the token as SHA-256 only", async () => {
    const { data } = await admin
      .from("sync_channels")
      .select("token_hash")
      .eq("calendar_id", calendarId)
      .single();
    expect(data?.token_hash).toBe(hash("tok-private"));
  });

  it.each([
    ["sync_push", { p_channel_id: "x", p_token: "x", p_state: "exists" }],
    ["sync_claim_stops", { p_limit: 1 }],
    ["sync_done_stop", { p_channel_id: "x" }],
  ] as const)("%s needs the secret", async (fn, args) => {
    const { error } = await engine.rpc(fn, {
      ...args,
      p_secret: "wrong",
    } as never);
    expect(error?.code).toBe("42501");
  });
});

describe("sync_push (RF-19, RF-21)", () => {
  beforeAll(async () => {
    await storeChannel("ch-push", "tok-push");
    await setRow({ push_pending_at: null });
  });

  it("ignores an unknown channel or a wrong token without telling them apart", async () => {
    const unknown = await engine.rpc("sync_push", {
      p_secret: SECRET,
      p_channel_id: "ch-nope",
      p_token: "tok-push",
      p_state: "exists",
    });
    const wrong = await engine.rpc("sync_push", {
      p_secret: SECRET,
      p_channel_id: "ch-push",
      p_token: "tok-wrong",
      p_state: "exists",
    });
    expect(unknown).toMatchObject({ error: null, data: null });
    expect(wrong).toMatchObject({ error: null, data: null });
    expect((await row()).push_pending_at).toBeNull();
  });

  it("ignores the first 'sync' notice of a channel", async () => {
    await engine.rpc("sync_push", {
      p_secret: SECRET,
      p_channel_id: "ch-push",
      p_token: "tok-push",
      p_state: "sync",
    });
    expect((await row()).push_pending_at).toBeNull();
  });

  it("marks the calendar with the right channel and token", async () => {
    await engine.rpc("sync_push", {
      p_secret: SECRET,
      p_channel_id: "ch-push",
      p_token: "tok-push",
      p_state: "exists",
    });
    expect((await row()).push_pending_at).not.toBeNull();
  });
});

describe("due (D7, RF-23, RF-24, RF-26)", () => {
  it.each([
    ["a notice, last attempt 2 min ago", 2 * MIN, true, 0, true],
    ["a notice, last attempt 30 s ago", 0.5 * MIN, true, 0, false],
    ["a notice on a failing calendar", 2 * MIN, true, 1, false],
    ["no notice, 10 min ago", 10 * MIN, false, 0, false],
    ["no notice, 20 min ago", 20 * MIN, false, 0, true],
  ])("%s → due %s", async (_, since, pending, failures, due) => {
    await setRow({
      last_attempt_at: ago(since),
      sync_started_at: null,
      consecutive_failures: failures,
      push_pending_at: pending ? ago(since / 2) : null,
    });
    expect((await claimMine()).length).toBe(due ? 1 : 0);
  });

  it("returns the version, the last full read, the notice and the channel expiry", async () => {
    await setRow({
      last_attempt_at: ago(20 * MIN),
      sync_started_at: null,
      consecutive_failures: 0,
      remote_version: "v1",
      full_read_at: ago(60 * MIN),
      push_pending_at: null,
    });
    const [claimed] = await claimMine();
    expect(claimed).toMatchObject({
      connection_id: connectionId,
      provider: "google",
      external_id: "fast-cal",
      remote_version: "v1",
      push_pending_at: null,
    });
    expect(claimed.full_read_at).not.toBeNull();
    expect(Date.parse(claimed.channel_expires_at!)).toBeGreaterThan(Date.now());
  });
});

describe("sync_mark_checked (D9, D12, RF-27, RF-30)", () => {
  it("a check without changes counts as an update and clears the notice", async () => {
    await setRow({
      last_attempt_at: ago(2 * MIN),
      sync_started_at: null,
      consecutive_failures: 0,
      push_pending_at: ago(3 * MIN),
      last_synced_at: null,
    });
    await claimMine();
    const { error } = await engine.rpc("sync_mark_checked", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_version: "v2",
      p_full: false,
    });
    expect(error).toBeNull();
    const after = await row();
    expect(after).toMatchObject({
      remote_version: "v2",
      push_pending_at: null,
      sync_started_at: null,
      consecutive_failures: 0,
    });
    expect(after.last_synced_at).not.toBeNull();
  });

  it("keeps a notice that arrived after the claim", async () => {
    await setRow({
      last_attempt_at: ago(2 * MIN),
      sync_started_at: null,
      push_pending_at: null,
    });
    await claimMine();
    await setRow({ push_pending_at: new Date(Date.now() + MIN).toISOString() });
    await engine.rpc("sync_mark_checked", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_version: "v3",
      p_full: false,
    });
    expect((await row()).push_pending_at).not.toBeNull();
  });

  it("a full read records full_read_at", async () => {
    await setRow({ full_read_at: null });
    await engine.rpc("sync_mark_checked", {
      p_secret: SECRET,
      p_calendar_id: calendarId,
      p_version: "v4",
      p_full: true,
    });
    const after = await row();
    expect(after.remote_version).toBe("v4");
    expect(after.full_read_at).not.toBeNull();
  });
});

describe("stops queue (D11, RF-22)", () => {
  it("replacing a channel queues the old one", async () => {
    await storeChannel("ch-old", "tok-old");
    await storeChannel("ch-new", "tok-new");
    const queued = (await stops()).map((s) => s.channel_id);
    expect(queued).toContain("ch-old");
    expect(queued).not.toContain("ch-new");
  });

  it("sync_trigger wakes the app for queued stops alone", async () => {
    await setRow({ last_attempt_at: ago(MIN), push_pending_at: null });
    await engine.rpc("sync_claim_due", { p_secret: SECRET, p_limit: 10_000 });
    const { data } = await admin.rpc("sync_trigger", { p_dry_run: true });
    expect(data).not.toBeNull();
  });

  it("claims stops with their provider and removes them when done", async () => {
    const { data } = await engine.rpc("sync_claim_stops", {
      p_secret: SECRET,
      p_limit: 100,
    });
    const mine = (data ?? []).filter((s) => s.connection_id === connectionId);
    expect(mine).toContainEqual({
      channel_id: "ch-old",
      resource_id: "res-ch-old",
      connection_id: connectionId,
      provider: "google",
    });
    for (const s of mine) {
      await engine.rpc("sync_done_stop", {
        p_secret: SECRET,
        p_channel_id: s.channel_id,
      });
    }
    expect(await stops()).toEqual([]);
  });

  it("reconnecting the account drops its channels into the queue", async () => {
    await owner.client.rpc("connect_account", {
      p_provider: "google",
      p_subject: "fast",
      p_email: "fast@gmail.test",
      p_refresh_token: "rt-again",
    });
    const { data } = await admin
      .from("sync_channels")
      .select("channel_id")
      .eq("calendar_id", calendarId);
    expect(data).toEqual([]);
    expect((await stops()).map((s) => s.channel_id)).toEqual(["ch-new"]);
  });

  it("drops the stops of a connection that no longer works", async () => {
    await admin
      .from("calendar_connections")
      .update({ status: "needs_reauth" })
      .eq("id", connectionId);
    const { data } = await engine.rpc("sync_claim_stops", {
      p_secret: SECRET,
      p_limit: 100,
    });
    expect(
      (data ?? []).filter((s) => s.connection_id === connectionId),
    ).toEqual([]);
    expect(await stops()).toEqual([]);
  });
});
