import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
  type TypedClient,
} from "./helpers";
import { getYearMarks } from "@/lib/calendar/queries";

// Spec 042, T2: calendar_day_marks gives which days have events of which
// calendars, with RLS (RF-5, plan D2), and last_view takes the new views.
let owner: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendarId: string;
let otherId: string;

async function add(
  calendar: string,
  extra: {
    starts_at: string;
    ends_at: string;
    all_day?: boolean;
    recurrence?: string;
    recurrence_tz?: string;
  },
) {
  const { error } = await admin.from("events").insert({
    calendar_id: calendar,
    title: "Evento",
    created_by: owner.id,
    ...extra,
  });
  if (error) throw error;
}

async function marks(client: TypedClient, from: string, to: string) {
  const { data, error } = await client.rpc("calendar_day_marks", {
    p_from: from,
    p_to: to,
  });
  return {
    error,
    rows: (data ?? [])
      .map((row) => `${row.day} ${row.calendar_id === calendarId ? "A" : "B"}`)
      .sort(),
  };
}

beforeAll(async () => {
  [owner, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Dueña" }),
    createTestUser({ display_name: "Lector" }),
    createTestUser({ display_name: "Ajeno" }),
  ]);
  calendarId = await getOwnCalendarId(owner.id);
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: "Trabajo" })
    .select("id")
    .single();
  if (error) throw error;
  otherId = data.id;
  await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: viewer.id, role: "viewer" });

  // Two events the same day: one mark. 23:30 in Madrid is the 3rd.
  await add(calendarId, {
    starts_at: "2026-03-03T09:00:00Z",
    ends_at: "2026-03-03T10:00:00Z",
  });
  await add(calendarId, {
    starts_at: "2026-03-03T22:30:00Z",
    ends_at: "2026-03-03T22:45:00Z",
  });
  // 23:30 UTC on the 4th is the 5th in Madrid.
  await add(calendarId, {
    starts_at: "2026-03-04T23:30:00Z",
    ends_at: "2026-03-05T00:30:00Z",
  });
  // All day from the 10th to the 12th: UTC dates, end exclusive.
  await add(calendarId, {
    all_day: true,
    starts_at: "2026-03-10T00:00:00Z",
    ends_at: "2026-03-13T00:00:00Z",
  });
  // Ends at midnight: only the 20th.
  await add(otherId, {
    starts_at: "2026-03-20T22:00:00Z",
    ends_at: "2026-03-20T23:00:00Z",
  });
  // A series is expanded by the app, never here.
  await add(calendarId, {
    starts_at: "2026-03-02T17:00:00Z",
    ends_at: "2026-03-02T18:00:00Z",
    recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
    recurrence_tz: "Europe/Madrid",
  });
  // Outside the asked days.
  await add(calendarId, {
    starts_at: "2026-04-01T10:00:00Z",
    ends_at: "2026-04-01T11:00:00Z",
  });
});

afterAll(async () => {
  await Promise.all(
    [owner, viewer, stranger]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("calendar_day_marks", () => {
  it("gives distinct days per calendar in the zone of the profile", async () => {
    const { rows, error } = await marks(
      owner.client,
      "2026-03-01",
      "2026-03-31",
    );
    expect(error).toBeNull();
    expect(rows).toEqual([
      "2026-03-03 A",
      "2026-03-05 A",
      "2026-03-10 A",
      "2026-03-11 A",
      "2026-03-12 A",
      "2026-03-20 B",
    ]);
  });

  it("cuts a long event to the days asked", async () => {
    const { rows } = await marks(owner.client, "2026-03-11", "2026-03-11");
    expect(rows).toEqual(["2026-03-11 A"]);
  });

  it("follows RLS: a reader sees its calendars, a stranger nothing", async () => {
    const reader = await marks(viewer.client, "2026-03-01", "2026-03-31");
    expect(reader.rows.every((row) => row.endsWith("A"))).toBe(true);
    expect(reader.rows).toHaveLength(5);
    expect(
      (await marks(stranger.client, "2026-03-01", "2026-03-31")).rows,
    ).toEqual([]);
    const anon = await anonClient().rpc("calendar_day_marks", {
      p_from: "2026-03-01",
      p_to: "2026-03-31",
    });
    expect(anon.error).not.toBeNull();
  });

  it("refuses more than 370 days or a reversed range", async () => {
    const tooLong = await marks(owner.client, "2026-01-01", "2027-01-07");
    expect(tooLong.error?.code).toBe("22023");
    const reversed = await marks(owner.client, "2026-03-02", "2026-03-01");
    expect(reversed.error?.code).toBe("22023");
    const year = await marks(owner.client, "2028-01-01", "2028-12-31");
    expect(year.error).toBeNull();
  });
});

describe("getYearMarks (spec 042 T4)", () => {
  it("adds the series' occurrences to the database's marks", async () => {
    const marks = await getYearMarks(
      owner.client,
      "2026-03-15",
      "Europe/Madrid",
    );
    // The weekly series on Mondays: 2 and 9 March, and every Monday after.
    expect(marks["2026-03-02"]).toEqual([calendarId]);
    expect(marks["2026-03-09"]).toEqual([calendarId]);
    expect(marks["2026-03-03"]).toEqual([calendarId]);
    expect(marks["2026-03-20"]).toEqual([otherId]);
    expect(marks["2026-12-28"]).toEqual([calendarId]);
  });
});

describe("profiles.last_view (spec 042 RF-11)", () => {
  it("saves the year and the 4 days", async () => {
    for (const view of ["year", "4days"]) {
      const { data, error } = await owner.client
        .from("profiles")
        .update({ last_view: view })
        .eq("id", owner.id)
        .select("last_view");
      expect(error).toBeNull();
      expect(data).toEqual([{ last_view: view }]);
    }
    const { error } = await owner.client
      .from("profiles")
      .update({ last_view: "decade" })
      .eq("id", owner.id);
    expect(error?.code).toBe("23514");
  });
});
