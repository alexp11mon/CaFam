import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 007, T2: connections, synced calendars and their RLS (plan "Modelo de
// datos", D6, D12; RF-6, RF-7, RF-26).
let ana: TestUser;
let bea: TestUser;
let anaCalendarId: string;
let connectionId: string;

async function createConnection(ownerId: string, subject: string) {
  const { data, error } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: ownerId,
      provider: "google",
      account_subject: subject,
      account_email: `${subject}@gmail.test`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [ana, bea] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
  ]);
  anaCalendarId = await getOwnCalendarId(ana.id);
  connectionId = await createConnection(ana.id, "sub-ana");

  const { error } = await admin.from("synced_calendars").insert({
    calendar_id: anaCalendarId,
    connection_id: connectionId,
    provider: "google",
    external_id: "primary",
  });
  if (error) throw error;

  // Bea becomes a viewer of the synced calendar.
  const { error: memberError } = await admin
    .from("calendar_members")
    .insert({ calendar_id: anaCalendarId, user_id: bea.id, role: "viewer" });
  if (memberError) throw memberError;
});

afterAll(async () => {
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("calendar_connections (RF-6, RF-7)", () => {
  it("the owner reads only their own connections", async () => {
    const own = await ana.client.from("calendar_connections").select("id");
    const other = await bea.client.from("calendar_connections").select("id");

    expect(own.data).toEqual([{ id: connectionId }]);
    expect(other.data).toEqual([]);
  });

  it("anon sees nothing", async () => {
    const { data } = await anonClient()
      .from("calendar_connections")
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("no client writes a connection", async () => {
    const insert = await ana.client.from("calendar_connections").insert({
      owner_id: ana.id,
      provider: "google",
      account_subject: "x",
      account_email: "x@gmail.test",
    });
    const update = await ana.client
      .from("calendar_connections")
      .update({ status: "needs_reauth" })
      .eq("id", connectionId);

    expect(insert.error?.code).toBe("42501");
    expect(update.error?.code).toBe("42501");
  });

  it("the same account is unique per user, but two users may share it", async () => {
    const duplicate = await admin.from("calendar_connections").insert({
      owner_id: ana.id,
      provider: "google",
      account_subject: "sub-ana",
      account_email: "otra@gmail.test",
    });
    expect(duplicate.error?.code).toBe("23505");

    const other = await createConnection(bea.id, "sub-ana");
    expect(other).toBeTruthy();
  });

  it("calendar_connection_secrets is not readable by any client", async () => {
    const { error } = await ana.client
      .from("calendar_connection_secrets")
      .select("connection_id");
    expect(error?.code).toBe("42501");
  });
});

describe("synced_calendars (RF-26)", () => {
  it("a member reads the synced row of their calendar", async () => {
    const { data } = await bea.client
      .from("synced_calendars")
      .select("calendar_id, state")
      .eq("calendar_id", anaCalendarId);
    expect(data).toEqual([{ calendar_id: anaCalendarId, state: "active" }]);
  });

  it("a member does not read the account email of the owner", async () => {
    const { data } = await bea.client
      .from("calendar_connections")
      .select("account_email")
      .eq("id", connectionId);
    expect(data).toEqual([]);
  });
});

describe("events.external_id", () => {
  it("is unique per calendar when not null", async () => {
    const row = {
      calendar_id: anaCalendarId,
      title: "Externo",
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
      external_id: "ext-1",
    };
    const first = await admin.from("events").insert(row);
    const second = await admin.from("events").insert(row);
    const noId = await admin.from("events").insert([
      { ...row, external_id: null },
      { ...row, external_id: null },
    ]);

    expect(first.error).toBeNull();
    expect(second.error?.code).toBe("23505");
    expect(noId.error).toBeNull();
  });
});

describe("account_notices", () => {
  it("accepts sync_revoked and sync_failing", async () => {
    const { error } = await admin.from("account_notices").insert([
      { user_id: ana.id, kind: "sync_revoked", calendar_name: "a@gmail.test" },
      { user_id: ana.id, kind: "sync_failing", calendar_name: "Trabajo" },
    ]);
    expect(error).toBeNull();
  });
});

describe("deleting a connection (D12)", () => {
  it("removes synced_calendars and keeps the calendar", async () => {
    const extra = await createConnection(ana.id, "sub-delete");
    const { data: calendar } = await admin
      .from("calendars")
      .insert({ owner_id: ana.id, name: "Traído" })
      .select("id")
      .single();
    await admin.from("synced_calendars").insert({
      calendar_id: calendar!.id,
      connection_id: extra,
      provider: "google",
      external_id: "cal-2",
    });

    await admin.from("calendar_connections").delete().eq("id", extra);

    const synced = await admin
      .from("synced_calendars")
      .select("calendar_id")
      .eq("calendar_id", calendar!.id);
    const kept = await admin
      .from("calendars")
      .select("id")
      .eq("id", calendar!.id);
    expect(synced.data).toEqual([]);
    expect(kept.data).toEqual([{ id: calendar!.id }]);
  });
});

describe("RLS everywhere (P3)", () => {
  it("no public table is left without RLS", async () => {
    const { data, error } = await admin.rpc("list_tables_without_rls");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
