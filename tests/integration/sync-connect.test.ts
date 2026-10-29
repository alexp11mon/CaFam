import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 007, T3: connect, choose calendars and disconnect (plan "Contratos";
// RF-6, RF-7, RF-8, RF-10, RF-11, RF-14, RF-27, RF-28, RF-29, RF-32, RF-45).
let ana: TestUser;
let bea: TestUser;
let anaOwn: string;
let beaOwn: string;

beforeAll(async () => {
  [ana, bea] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Bea" }),
  ]);
  [anaOwn, beaOwn] = await Promise.all([
    getOwnCalendarId(ana.id),
    getOwnCalendarId(bea.id),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [ana, bea].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

async function connect(user: TestUser, subject: string, token = "rt-1") {
  const { data, error } = await user.client.rpc("connect_account", {
    p_provider: "google",
    p_subject: subject,
    p_email: `${subject}@gmail.test`,
    p_refresh_token: token,
  });
  if (error) throw error;
  return data as { id: string; existed: boolean };
}

async function secretOf(connectionId: string) {
  const { data } = await admin
    .from("calendar_connection_secrets")
    .select("vault_secret_id")
    .eq("connection_id", connectionId)
    .maybeSingle();
  return data?.vault_secret_id ?? null;
}

async function tokenIs(secretId: string, value: string) {
  const { data, error } = await admin.rpc("vault_secret_matches", {
    p_id: secretId,
    p_value: value,
  });
  if (error) throw error;
  return data;
}

function calendars(n: number, prefix = "cal") {
  return Array.from({ length: n }, (_, i) => ({
    external_id: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
    color: "#A0C4FF",
  }));
}

async function select(
  user: TestUser,
  connectionId: string,
  items: { external_id: string; name: string; color: string }[],
) {
  return user.client.rpc("select_synced_calendars", {
    p_connection_id: connectionId,
    p_calendars: items,
  });
}

async function syncedOf(connectionId: string) {
  const { data } = await admin
    .from("synced_calendars")
    .select("calendar_id, external_id")
    .eq("connection_id", connectionId)
    .order("external_id");
  return data ?? [];
}

describe("connect_account (RF-6, RF-7, RF-8, RF-32)", () => {
  it("creates the connection and keeps the token only in Vault", async () => {
    const { id, existed } = await connect(ana, "a1", "secret-token-a1");
    expect(existed).toBe(false);

    const secretId = await secretOf(id);
    expect(secretId).not.toBeNull();
    expect(await tokenIs(secretId!, "secret-token-a1")).toBe(true);

    const { data } = await admin
      .from("calendar_connections")
      .select("*")
      .eq("id", id);
    expect(JSON.stringify(data)).not.toContain("secret-token-a1");
  });

  it("does not duplicate the account: replaces the token and reactivates it", async () => {
    const first = await connect(ana, "a2", "old");
    await admin
      .from("calendar_connections")
      .update({ status: "needs_reauth" })
      .eq("id", first.id);
    const { data: cal } = await admin
      .from("calendars")
      .insert({ owner_id: ana.id, name: "Fallos" })
      .select("id")
      .single();
    await admin.from("synced_calendars").insert({
      calendar_id: cal!.id,
      connection_id: first.id,
      provider: "google",
      external_id: "x",
      consecutive_failures: 2,
    });

    const second = await connect(ana, "a2", "new");

    expect(second).toEqual({ id: first.id, existed: true });
    expect(await tokenIs((await secretOf(first.id))!, "new")).toBe(true);
    const { data: row } = await admin
      .from("calendar_connections")
      .select("status")
      .eq("id", first.id)
      .single();
    expect(row?.status).toBe("active");
    const { data: synced } = await admin
      .from("synced_calendars")
      .select("consecutive_failures")
      .eq("calendar_id", cal!.id)
      .single();
    expect(synced?.consecutive_failures).toBe(0);
  });

  it("lets two users connect the same account independently (RF-7)", async () => {
    const a = await connect(ana, "shared");
    const b = await connect(bea, "shared");
    expect(a.id).not.toBe(b.id);
  });

  it("refuses the sixth account with CF429 (RF-8)", async () => {
    // Ana already has a1, a2 and shared.
    await connect(ana, "a4");
    await connect(ana, "a5");
    const { error } = await ana.client.rpc("connect_account", {
      p_provider: "google",
      p_subject: "a6",
      p_email: "a6@gmail.test",
      p_refresh_token: "t",
    });
    expect(error?.code).toBe("CF429");
    // Reconnecting an existing account is still allowed at the limit.
    expect((await connect(ana, "a5")).existed).toBe(true);
  });

  it("fails without a session (42501)", async () => {
    const { error } = await anonClient().rpc("connect_account", {
      p_provider: "google",
      p_subject: "anon",
      p_email: "anon@gmail.test",
      p_refresh_token: "t",
    });
    expect(error?.code).toBe("42501");
  });
});

describe("select_synced_calendars (RF-10, RF-14)", () => {
  let connectionId: string;

  beforeAll(async () => {
    connectionId = (await connect(bea, "b1")).id;
  });

  it("creates an own calendar per new item with its name and color", async () => {
    const { error } = await select(bea, connectionId, [
      { external_id: "work", name: "Trabajo", color: "#FFADAD" },
    ]);
    expect(error).toBeNull();

    const [row] = await syncedOf(connectionId);
    const { data: calendar } = await admin
      .from("calendars")
      .select("owner_id, name, color")
      .eq("id", row.calendar_id)
      .single();
    expect(calendar).toEqual({
      owner_id: bea.id,
      name: "Trabajo",
      color: "#FFADAD",
    });
  });

  it("does not touch or duplicate calendars already synced", async () => {
    const before = await syncedOf(connectionId);
    await admin
      .from("calendars")
      // The name is protected since spec 009 (D13): the color shows the same.
      .update({ color: "#BDB2FF" })
      .eq("id", before[0].calendar_id);

    await select(bea, connectionId, [
      { external_id: "work", name: "Trabajo", color: "#FFADAD" },
    ]);

    expect(await syncedOf(connectionId)).toEqual(before);
    const { data } = await admin
      .from("calendars")
      .select("color")
      .eq("id", before[0].calendar_id)
      .single();
    expect(data?.color).toBe("#BDB2FF");
  });

  it("refuses the twenty-first calendar with CF429", async () => {
    const ok = await select(bea, connectionId, calendars(19));
    expect(ok.error).toBeNull();

    const { error } = await select(bea, connectionId, calendars(1, "extra"));
    expect(error?.code).toBe("CF429");
    expect(await syncedOf(connectionId)).toHaveLength(20);
  });

  it("fails with CF404 on another user's connection", async () => {
    const { error } = await select(ana, connectionId, calendars(1, "steal"));
    expect(error?.code).toBe("CF404");
  });
});

describe("detach_synced_calendars (RF-11, RF-28, RF-29, RF-45)", () => {
  let connectionId: string;
  let keptId: string;
  let deletedId: string;

  beforeAll(async () => {
    connectionId = (await connect(bea, "b2")).id;
    await select(bea, connectionId, calendars(2, "d"));
    [keptId, deletedId] = (await syncedOf(connectionId)).map(
      (r) => r.calendar_id,
    );
    await admin.from("events").insert(
      [keptId, deletedId].map((calendar_id) => ({
        calendar_id,
        title: "Traído",
        starts_at: "2026-11-02T10:00:00Z",
        ends_at: "2026-11-02T11:00:00Z",
        external_id: "e1",
      })),
    );
    await admin
      .from("calendar_members")
      .insert({ calendar_id: deletedId, user_id: ana.id, role: "viewer" });
  });

  it("keeping removes the link and the external ids; the calendar becomes editable", async () => {
    const { error } = await bea.client.rpc("detach_synced_calendars", {
      p_connection_id: connectionId,
      p_calendar_ids: [keptId],
      p_delete: false,
    });
    expect(error).toBeNull();

    const { data: events } = await admin
      .from("events")
      .select("external_id")
      .eq("calendar_id", keptId);
    expect(events).toEqual([{ external_id: null }]);
    expect(
      (await syncedOf(connectionId)).map((r) => r.calendar_id),
    ).not.toContain(keptId);

    const insert = await bea.client.from("events").insert({
      calendar_id: keptId,
      title: "Mío",
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
    });
    expect(insert.error).toBeNull();

    // Merging is allowed again (RF-45).
    const own = beaOwn;
    const merge = await bea.client.rpc("merge_calendars", {
      p_source_ids: [own, keptId],
      p_target_id: own,
    });
    expect(merge.error).toBeNull();
  });

  it("deleting removes the calendar with its events and members", async () => {
    const { error } = await bea.client.rpc("detach_synced_calendars", {
      p_connection_id: connectionId,
      p_calendar_ids: [deletedId],
      p_delete: true,
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("id", deletedId);
    const { data: members } = await admin
      .from("calendar_members")
      .select("user_id")
      .eq("calendar_id", deletedId);
    expect(data).toEqual([]);
    expect(members).toEqual([]);
  });

  it("does not touch calendars that are not synced or of another user", async () => {
    const own = anaOwn;
    const { error } = await ana.client.rpc("detach_synced_calendars", {
      p_connection_id: connectionId,
      p_calendar_ids: [own],
      p_delete: true,
    });
    expect(error?.code).toBe("CF404");

    const mine = (await connect(ana, "a1")).id;
    await ana.client.rpc("detach_synced_calendars", {
      p_connection_id: mine,
      p_calendar_ids: [own],
      p_delete: true,
    });
    const { data } = await admin.from("calendars").select("id").eq("id", own);
    expect(data).toEqual([{ id: own }]);
  });
});

describe("disconnect_account (RF-27 to RF-30)", () => {
  it("applies the choice to all its calendars and removes token and connection", async () => {
    const { id } = await connect(bea, "b3", "bye");
    const secretId = (await secretOf(id))!;
    await select(bea, id, calendars(2, "x"));
    const ids = (await syncedOf(id)).map((r) => r.calendar_id);

    const other = await bea.client.rpc("disconnect_account", {
      p_connection_id: id,
      p_delete: true,
    });
    expect(other.error).toBeNull();

    const { data: left } = await admin
      .from("calendars")
      .select("id")
      .in("id", ids);
    const { data: connection } = await admin
      .from("calendar_connections")
      .select("id")
      .eq("id", id);
    expect(left).toEqual([]);
    expect(connection).toEqual([]);
    expect(await tokenIs(secretId, "bye")).toBe(false);
  });

  it("keeping leaves the calendars as normal ones", async () => {
    const { id } = await connect(bea, "b4");
    await select(bea, id, calendars(1, "k"));
    const [{ calendar_id }] = await syncedOf(id);

    await bea.client.rpc("disconnect_account", {
      p_connection_id: id,
      p_delete: false,
    });

    const { data } = await admin
      .from("calendars")
      .select("id")
      .eq("id", calendar_id);
    expect(data).toEqual([{ id: calendar_id }]);
    const { data: synced } = await admin
      .from("synced_calendars")
      .select("calendar_id")
      .eq("calendar_id", calendar_id);
    expect(synced).toEqual([]);
  });

  it("only the owner can disconnect (CF404)", async () => {
    const { id } = await connect(bea, "b5");
    const { error } = await ana.client.rpc("disconnect_account", {
      p_connection_id: id,
      p_delete: true,
    });
    expect(error?.code).toBe("CF404");
  });
});
