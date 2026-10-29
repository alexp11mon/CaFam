import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 009, T2: write permission per account and per calendar, and the
// protected name of a synced calendar (plan "Modelo de datos", D2, D10, D11,
// D13; RF-2, RF-4, RF-5, RF-8, RF-29).
let owner: TestUser;
let editor: TestUser;
let connectionId: string;
let calendarId: string;
let ownCalendar: string;

async function connect(canWrite?: boolean) {
  const { data, error } = await owner.client.rpc("connect_account", {
    p_provider: "google",
    p_subject: "write-schema",
    p_email: "write-schema@gmail.test",
    p_refresh_token: "rt",
    ...(canWrite === undefined ? {} : { p_can_write: canWrite }),
  });
  if (error) throw error;
  return data as { id: string; existed: boolean };
}

async function canWriteAs({ client }: TestUser) {
  const { data, error } = await client
    .from("synced_calendars")
    .select("calendar_id, can_write")
    .eq("calendar_id", calendarId)
    .single();
  if (error) throw error;
  return (data as unknown as { can_write: boolean }).can_write;
}

beforeAll(async () => {
  [owner, editor] = await Promise.all([
    createTestUser({ display_name: "Owner" }),
    createTestUser({ display_name: "Editor" }),
  ]);
  ownCalendar = await getOwnCalendarId(owner.id);
  connectionId = (await connect()).id;
  const { data, error } = await owner.client.rpc("select_synced_calendars", {
    p_connection_id: connectionId,
    p_calendars: [
      { external_id: "cal-w", name: "Casa", color: "#A0C4FF", access: "owner" },
    ],
  });
  if (error) throw error;
  calendarId = (data as { calendar_id: string }[])[0].calendar_id;
  const { error: memberError } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: editor.id, role: "editor" });
  if (memberError) throw memberError;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

describe("account write permission (RF-2, RF-4, RF-5)", () => {
  it("a 007 connection cannot write", async () => {
    const { data } = await owner.client
      .from("calendar_connections")
      .select("can_write")
      .eq("id", connectionId)
      .single();
    expect(data?.can_write).toBe(false);
    expect(await canWriteAs(owner)).toBe(false);
  });

  it("connecting again with write keeps the calendars", async () => {
    const result = await connect(true);
    expect(result).toEqual({ id: connectionId, existed: true });
    const { count } = await admin
      .from("synced_calendars")
      .select("calendar_id", { count: "exact", head: true })
      .eq("connection_id", connectionId);
    expect(count).toBe(1);
    expect(await canWriteAs(owner)).toBe(true);
  });

  it("an editor sees can_write without seeing the connection", async () => {
    expect(await canWriteAs(editor)).toBe(true);
    const { data } = await editor.client
      .from("calendar_connections")
      .select("id");
    expect(data).toEqual([]);
  });

  it("connecting again without every permission goes back to read-only", async () => {
    await connect(false);
    expect(await canWriteAs(owner)).toBe(false);
    await connect(true);
  });
});

describe("calendar permission in Google (RF-8)", () => {
  it("select_synced_calendars stores google_access", async () => {
    const { data } = await admin
      .from("synced_calendars")
      .select("google_access")
      .eq("calendar_id", calendarId)
      .single();
    expect(data?.google_access).toBe("owner");
  });

  it("only owner or writer access can write", async () => {
    for (const [access, expected] of [
      ["reader", false],
      ["writer", true],
      [null, false],
      ["owner", true],
    ] as const) {
      await admin
        .from("synced_calendars")
        .update({ google_access: access })
        .eq("calendar_id", calendarId);
      expect(await canWriteAs(editor)).toBe(expected);
    }
  });

  it("a missing calendar or an expired account cannot write", async () => {
    await admin
      .from("synced_calendars")
      .update({ state: "missing" })
      .eq("calendar_id", calendarId);
    expect(await canWriteAs(owner)).toBe(false);
    await admin
      .from("synced_calendars")
      .update({ state: "active" })
      .eq("calendar_id", calendarId);

    await admin
      .from("calendar_connections")
      .update({ status: "needs_reauth" })
      .eq("id", connectionId);
    expect(await canWriteAs(owner)).toBe(false);
    await admin
      .from("calendar_connections")
      .update({ status: "active" })
      .eq("id", connectionId);
    expect(await canWriteAs(owner)).toBe(true);
  });
});

describe("name of a synced calendar (RF-29, D13)", () => {
  it("cannot be changed with a direct update", async () => {
    const { error } = await owner.client
      .from("calendars")
      .update({ name: "Otro" })
      .eq("id", calendarId);
    expect(error?.code).toBe("42501");
  });

  it("color and description still change directly", async () => {
    const { data, error } = await owner.client
      .from("calendars")
      .update({ color: "#FFADAD", description: "Solo CaFam" })
      .eq("id", calendarId)
      .select("name, color");
    expect(error).toBeNull();
    expect(data).toEqual([{ name: "Casa", color: "#FFADAD" }]);
  });

  it("a normal calendar is renamed as before", async () => {
    const { error } = await owner.client
      .from("calendars")
      .update({ name: "Mío" })
      .eq("id", ownCalendar);
    expect(error).toBeNull();
  });
});

describe("RLS (P3)", () => {
  it("no table without RLS", async () => {
    const { data, error } = await admin.rpc("list_tables_without_rls");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
