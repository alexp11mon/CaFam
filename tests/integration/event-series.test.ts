import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteQueuedImages,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 013: series and their exceptions in public.events (plan "Modelo de
// datos" and "Contratos"; T1 schema, T6 functions, T8 copy and upload).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;

const WEEKLY = "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU";
const SERIES = {
  title: "Extraescolar",
  starts_at: "2026-11-03T17:00:00Z",
  ends_at: "2026-11-03T18:00:00Z",
  recurrence: WEEKLY,
  recurrence_tz: "Europe/Madrid",
};

beforeAll(async () => {
  [owner, editor, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Eva" }),
    createTestUser({ display_name: "Vic" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: calendar, user_id: editor.id, role: "editor" },
    { calendar_id: calendar, user_id: viewer.id, role: "viewer" },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, stranger].map((user) => deleteTestUser(user.id)),
  );
});

async function createCalendar(ownerId: string, name: string) {
  const { data, error } = await admin
    .from("calendars")
    .insert({ owner_id: ownerId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedSeries(calendarId: string, extra: object = {}) {
  const { data, error } = await admin
    .from("events")
    .insert({ calendar_id: calendarId, ...SERIES, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedException(
  seriesId: string,
  calendarId: string,
  originalStart: string,
  extra: object = {},
) {
  const end = new Date(Date.parse(originalStart) + 3_600_000).toISOString();
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: calendarId,
      title: "Extraescolar",
      starts_at: originalStart,
      ends_at: end,
      series_id: seriesId,
      original_start: originalStart,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** The n-th Tuesday after the first one, at 17:00 UTC. */
function tuesday(n: number) {
  return new Date(
    Date.parse(SERIES.starts_at) + n * 7 * 86_400_000,
  ).toISOString();
}

async function seedSynced(ownerId: string) {
  const id = await createCalendar(ownerId, "Google");
  const { data: connection, error } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: ownerId,
      provider: "google",
      account_subject: `sub-${randomUUID()}`,
      account_email: "owner@gmail.test",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: syncedError } = await admin.from("synced_calendars").insert({
    calendar_id: id,
    connection_id: connection.id,
    provider: "google",
    external_id: `cal-${randomUUID()}`,
  });
  if (syncedError) throw syncedError;
  return id;
}

describe("series schema (T1)", () => {
  it("owner and editor create series; a viewer cannot (RF-6)", async () => {
    for (const user of [owner, editor]) {
      const { error } = await user.client
        .from("events")
        .insert({ calendar_id: calendar, ...SERIES })
        .select("id")
        .single();
      expect(error).toBeNull();
    }
    const { data, error } = await viewer.client
      .from("events")
      .insert({ calendar_id: calendar, ...SERIES })
      .select("id");
    expect(error?.code ?? (data ?? []).length).toBeTruthy();
    expect(data ?? []).toHaveLength(0);
  });

  it("members read series and exceptions; strangers and anon do not (P3)", async () => {
    const series = await seedSeries(calendar);
    const exception = await seedException(series, calendar, tuesday(1));
    for (const user of [owner, editor, viewer]) {
      const { data } = await user.client
        .from("events")
        .select("id")
        .in("id", [series, exception]);
      expect(data).toHaveLength(2);
    }
    const { data: strange } = await stranger.client
      .from("events")
      .select("id")
      .in("id", [series, exception]);
    expect(strange).toHaveLength(0);
    const { data: anon } = await anonClient()
      .from("events")
      .select("id")
      .in("id", [series, exception]);
    expect(anon ?? []).toHaveLength(0);
  });

  it("rejects malformed series and exceptions", async () => {
    const bad = [
      { ...SERIES, recurrence_tz: null },
      { ...SERIES, all_day: true },
      { ...SERIES, recurrence: "RRULE:FREQ=WEEKLY" },
      { ...SERIES, recurrence: "FREQ=HOURLY" },
      { ...SERIES, recurrence: `FREQ=DAILY;X=${"A".repeat(200)}` },
      { ...SERIES, recurrence_tz: "Mars/Olympus" },
      { ...SERIES, recurrence: null },
    ];
    for (const row of bad) {
      const { error } = await admin
        .from("events")
        .insert({ calendar_id: calendar, ...row });
      expect(error, JSON.stringify(row)).not.toBeNull();
    }

    const series = await seedSeries(calendar);
    const { error: noOriginal } = await admin.from("events").insert({
      calendar_id: calendar,
      title: "x",
      starts_at: tuesday(1),
      ends_at: tuesday(1),
      series_id: series,
    });
    expect(noOriginal).not.toBeNull();

    const { error: nested } = await admin.from("events").insert({
      calendar_id: calendar,
      ...SERIES,
      series_id: series,
      original_start: tuesday(1),
    });
    expect(nested).not.toBeNull();
  });

  it("accepts an all-day series without time zone (RF-6, RF-14)", async () => {
    const { error } = await admin.from("events").insert({
      calendar_id: calendar,
      title: "Cumpleaños",
      starts_at: "2026-11-10T00:00:00Z",
      ends_at: "2026-11-11T00:00:00Z",
      all_day: true,
      recurrence: "FREQ=YEARLY;INTERVAL=1;BYMONTH=11;BYMONTHDAY=10",
    });
    expect(error).toBeNull();
  });

  it("an exception lives in its series' calendar, once per occurrence", async () => {
    const other = await createCalendar(owner.id, "Otro");
    const series = await seedSeries(calendar);
    await seedException(series, calendar, tuesday(2));

    const { error: twice } = await admin.from("events").insert({
      calendar_id: calendar,
      title: "x",
      starts_at: tuesday(2),
      ends_at: tuesday(2),
      series_id: series,
      original_start: tuesday(2),
    });
    expect(twice).not.toBeNull();

    const { error: elsewhere } = await admin.from("events").insert({
      calendar_id: other,
      title: "x",
      starts_at: tuesday(3),
      ends_at: tuesday(3),
      series_id: series,
      original_start: tuesday(3),
    });
    expect(elsewhere).not.toBeNull();

    const single = (
      await admin
        .from("events")
        .insert({
          calendar_id: calendar,
          title: "Suelto",
          starts_at: tuesday(0),
          ends_at: tuesday(0),
        })
        .select("id")
        .single()
    ).data!.id;
    const { error: notASeries } = await admin.from("events").insert({
      calendar_id: calendar,
      title: "x",
      starts_at: tuesday(0),
      ends_at: tuesday(0),
      series_id: single,
      original_start: tuesday(0),
    });
    expect(notASeries?.code).toBe("22023");
  });

  it("moving a series moves its exceptions; deleting it deletes them (RF-23)", async () => {
    const other = await createCalendar(owner.id, "Destino");
    const series = await seedSeries(calendar);
    const exception = await seedException(series, calendar, tuesday(1));

    const { error } = await owner.client
      .from("events")
      .update({ calendar_id: other })
      .eq("id", series);
    expect(error).toBeNull();
    const { data: moved } = await admin
      .from("events")
      .select("calendar_id")
      .eq("id", exception)
      .single();
    expect(moved?.calendar_id).toBe(other);

    await owner.client.from("events").delete().eq("id", series);
    const { data: gone } = await admin
      .from("events")
      .select("id")
      .eq("id", exception);
    expect(gone).toHaveLength(0);
  });

  it("a series cannot become a single event while it has exceptions", async () => {
    const series = await seedSeries(calendar);
    await seedException(series, calendar, tuesday(1));
    const { error } = await admin
      .from("events")
      .update({ recurrence: null, recurrence_tz: null })
      .eq("id", series);
    expect(error?.code).toBe("22023");
  });

  it("no series in a synced calendar (RF-29)", async () => {
    const synced = await seedSynced(owner.id);
    const { error } = await admin
      .from("events")
      .insert({ calendar_id: synced, ...SERIES });
    expect(error?.code).toBe("22023");
  });

  it("500 series per calendar at most (RF-31)", async () => {
    const full = await createCalendar(owner.id, "Lleno");
    const rows = Array.from({ length: 500 }, () => ({
      calendar_id: full,
      ...SERIES,
    }));
    const { error } = await admin.from("events").insert(rows);
    expect(error).toBeNull();

    const { error: over } = await admin
      .from("events")
      .insert({ calendar_id: full, ...SERIES });
    expect(over?.code).toBe("CF429");
    expect(over?.message).toBe("series");

    // Moving one in counts too (merging calendars, RF-25).
    const outside = await seedSeries(calendar);
    const { error: moved } = await admin
      .from("events")
      .update({ calendar_id: full })
      .eq("id", outside);
    expect(moved?.code).toBe("CF429");
  });

  it("100 exceptions per series at most, counting exdates (RF-32)", async () => {
    const series = await seedSeries(calendar, {
      exdates: [tuesday(1), tuesday(2)],
    });
    const rows = Array.from({ length: 98 }, (_, i) => {
      const start = tuesday(i + 3);
      return {
        calendar_id: calendar,
        title: "x",
        starts_at: start,
        ends_at: start,
        series_id: series,
        original_start: start,
      };
    });
    const { error } = await admin.from("events").insert(rows);
    expect(error).toBeNull();

    const { error: over } = await admin.from("events").insert({
      calendar_id: calendar,
      title: "x",
      starts_at: tuesday(200),
      ends_at: tuesday(200),
      series_id: series,
      original_start: tuesday(200),
    });
    expect(over?.code).toBe("CF429");
    expect(over?.message).toBe("exceptions");

    const { error: exdate } = await admin
      .from("events")
      .update({ exdates: [tuesday(1), tuesday(2), tuesday(300)] })
      .eq("id", series);
    expect(exdate?.code).toBe("CF429");
  });

  it("images never go to a series, only to an occurrence row (RF-24)", async () => {
    const series = await seedSeries(calendar);
    const exception = await seedException(series, calendar, tuesday(1));
    const image = [{ bytes: 1000, width: 100, height: 100 }];

    const { error } = await viewer.client.rpc("reserve_event_images", {
      p_event_id: series,
      p_images: image,
    });
    expect(error?.code).toBe("22023");

    const { data, error: ok } = await viewer.client.rpc(
      "reserve_event_images",
      { p_event_id: exception, p_images: image },
    );
    expect(ok).toBeNull();
    expect(data).toHaveLength(1);
    await admin
      .from("event_images")
      .delete()
      .in("id", data ?? []);
    await deleteQueuedImages(data ?? []);
  });
});
