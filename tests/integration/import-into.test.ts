import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 044, T2: import into an existing calendar (RF-1..RF-4).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let calendarId: string;
let syncedId: string;

function event(id: string, day = 20) {
  return {
    title: `Evento ${id}`,
    description: null,
    location: null,
    starts_at: `2026-11-${day}T09:00:00Z`,
    ends_at: `2026-11-${day}T10:00:00Z`,
    all_day: false,
    external_id: id,
  };
}

beforeAll(async () => {
  [owner, editor, viewer] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Editor" }),
    createTestUser({ display_name: "Lector" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  const { data: calendar, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: "Google" })
    .select("id")
    .single();
  if (error) throw error;
  syncedId = calendar.id;
  const { data: connection, error: connectionError } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: owner.id,
      provider: "google",
      account_subject: `sub-${owner.id}`,
      account_email: "owner@gmail.test",
    })
    .select("id")
    .single();
  if (connectionError) throw connectionError;
  await admin.from("synced_calendars").insert({
    calendar_id: syncedId,
    connection_id: connection.id,
    provider: "google",
    external_id: "primary",
  });
  await admin.from("calendar_members").insert([
    { calendar_id: calendarId, user_id: editor.id, role: "editor" },
    { calendar_id: calendarId, user_id: viewer.id, role: "viewer" },
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("import_into_calendar", () => {
  it("adds the new events and counts the ones already there", async () => {
    const first = await editor.client.rpc("import_into_calendar", {
      p_calendar_id: calendarId,
      p_events: [event("a"), event("b")],
    });
    expect(first.error).toBeNull();
    expect(first.data).toEqual({ added: 2, existing: 0 });

    const second = await owner.client.rpc("import_into_calendar", {
      p_calendar_id: calendarId,
      p_events: [event("a"), event("b"), event("c")],
    });
    expect(second.data).toEqual({ added: 1, existing: 2 });

    const { data } = await admin
      .from("events")
      .select("external_id, created_by")
      .eq("calendar_id", calendarId)
      .order("external_id");
    expect(data?.map((row) => row.external_id)).toEqual(["a", "b", "c"]);
    expect(data?.[0]?.created_by).toBe(editor.id);
  });

  it("refuses a viewer and a calendar brought from an account", async () => {
    const asViewer = await viewer.client.rpc("import_into_calendar", {
      p_calendar_id: calendarId,
      p_events: [event("v")],
    });
    expect(asViewer.error?.code).toBe("CF404");
    const synced = await owner.client.rpc("import_into_calendar", {
      p_calendar_id: syncedId,
      p_events: [event("s")],
    });
    expect(synced.error?.code).toBe("22023");
  });

  it("keeps the calendar at 10,000 imported events", async () => {
    const { data: big, error } = await admin
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Grande" })
      .select("id")
      .single();
    if (error) throw error;
    const rows = Array.from({ length: 10_000 }, (_, i) => ({
      calendar_id: big.id,
      created_by: owner.id,
      title: "x",
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-01-01T01:00:00Z",
      external_id: `bulk-${i}`,
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      const { error: bulkError } = await admin
        .from("events")
        .insert(rows.slice(i, i + 1000));
      if (bulkError) throw bulkError;
    }
    const over = await owner.client.rpc("import_into_calendar", {
      p_calendar_id: big.id,
      p_events: [event("one-more")],
    });
    expect(over.error?.code).toBe("CF429");
    // Nothing of the failed call stays.
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", big.id);
    expect(count).toBe(10_000);
  }, 60_000);

  it("import_calendar stores the identity too", async () => {
    const { data: id, error } = await owner.client.rpc("import_calendar", {
      p_name: "Colegio",
      p_color: "#A0C4FF",
      p_events: [event("x"), event("x", 21)],
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("events")
      .select("external_id")
      .eq("calendar_id", id!);
    expect(data).toEqual([{ external_id: "x" }]);
  });
});
