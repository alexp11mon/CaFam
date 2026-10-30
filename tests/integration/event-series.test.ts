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

async function rows(seriesId: string) {
  const { data, error } = await admin
    .from("events")
    .select("id, title, location, starts_at, ends_at, original_start")
    .eq("series_id", seriesId)
    .order("original_start");
  if (error) throw error;
  return data;
}

async function seriesRow(id: string) {
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function seedImageOn(eventId: string, uploadedBy: string) {
  const id = randomUUID();
  const { error } = await admin.from("event_images").insert({
    id,
    event_id: eventId,
    object_id: id,
    uploaded_by: uploadedBy,
    status: "ready",
    bytes: 1000,
    width: 100,
    height: 100,
  });
  if (error) throw error;
  return id;
}

const ms = (value: string | null | undefined) => Date.parse(value ?? "");
// The generated types mark every function argument as non-null; SQL takes null.
const NULL = null as unknown as string;

describe("series functions (T6)", () => {
  it("update_occurrence creates the exception, then updates it (RF-16)", async () => {
    const series = await seedSeries(calendar);
    const { data: id, error } = await editor.client.rpc("update_occurrence", {
      p_series_id: series,
      p_original_start: tuesday(2),
      p_fields: { title: "Sin clase", location: "Casa" },
    });
    expect(error).toBeNull();
    const [row] = await rows(series);
    expect(row).toMatchObject({ id, title: "Sin clase", location: "Casa" });
    expect(ms(row!.starts_at)).toBe(ms(tuesday(2)));

    const { data: again } = await owner.client.rpc("update_occurrence", {
      p_series_id: series,
      p_original_start: tuesday(2),
      p_fields: { title: "Clase corta" },
    });
    expect(again).toBe(id);
    expect((await rows(series))[0]!.title).toBe("Clase corta");
  });

  it("update_occurrence with no fields creates an identical row (RF-24)", async () => {
    const series = await seedSeries(calendar);
    const { error } = await viewer.client.rpc("update_occurrence", {
      p_series_id: series,
      p_original_start: tuesday(1),
      p_fields: {},
    });
    expect(error?.code).toBe("CF404");

    const { data: id } = await editor.client.rpc("update_occurrence", {
      p_series_id: series,
      p_original_start: tuesday(1),
      p_fields: {},
    });
    const [row] = await rows(series);
    expect(row).toMatchObject({ id, title: "Extraescolar", location: null });
    expect(ms(row!.ends_at) - ms(row!.starts_at)).toBe(3_600_000);
  });

  it("refuses unknown fields and a 101st exception (RF-32)", async () => {
    const series = await seedSeries(calendar);
    const { error } = await owner.client.rpc("update_occurrence", {
      p_series_id: series,
      p_original_start: tuesday(1),
      p_fields: { calendar_id: randomUUID() },
    });
    expect(error?.code).toBe("22023");

    const full = await seedSeries(calendar, {
      exdates: Array.from({ length: 100 }, (_, i) => tuesday(i + 100)),
    });
    const { error: over } = await owner.client.rpc("update_occurrence", {
      p_series_id: full,
      p_original_start: tuesday(1),
      p_fields: {},
    });
    expect(over?.code).toBe("CF429");
  });

  it("split_series ends the series and moves later exceptions when kept (RF-17)", async () => {
    const series = await seedSeries(calendar, {
      exdates: [tuesday(1), tuesday(5)],
    });
    await seedException(series, calendar, tuesday(2), { title: "Excursión" });
    const later = await seedException(series, calendar, tuesday(4));
    const { data: newId, error } = await owner.client.rpc("split_series", {
      p_series_id: series,
      p_original_start: tuesday(3),
      p_old_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261116T235959",
      p_old_until: tuesday(2),
      p_new: {
        title: "Extraescolar nueva",
        starts_at: tuesday(3),
        ends_at: tuesday(3),
        recurrence: WEEKLY,
        recurrence_until: NULL,
      },
      p_keep_exceptions: true,
    });
    expect(error).toBeNull();

    const old = await seriesRow(series);
    expect(old?.recurrence).toContain("UNTIL=20261116");
    expect(old?.exdates.map(ms)).toEqual([ms(tuesday(1))]);
    expect((await rows(series)).map((r) => r.title)).toEqual(["Excursión"]);

    const next = await seriesRow(newId!);
    expect(next).toMatchObject({
      title: "Extraescolar nueva",
      recurrence: WEEKLY,
    });
    expect(next?.exdates).toHaveLength(1);
    // The later exception kept the old title, so it follows the change.
    expect(await rows(newId!)).toEqual([
      expect.objectContaining({ id: later, title: "Extraescolar nueva" }),
    ]);
  });

  it("split_series without keeping drops later exceptions (plan D11)", async () => {
    const series = await seedSeries(calendar);
    const later = await seedException(series, calendar, tuesday(4));
    const { data: newId, error } = await owner.client.rpc("split_series", {
      p_series_id: series,
      p_original_start: tuesday(3),
      p_old_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=3",
      p_old_until: tuesday(2),
      p_new: {
        starts_at: tuesday(3),
        ends_at: tuesday(3),
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE",
      },
      p_keep_exceptions: false,
    });
    expect(error).toBeNull();
    expect(await rows(newId!)).toEqual([]);
    expect(await seriesRow(later)).toBeNull();
  });

  it("update_series propagates only what matched the series (RF-18)", async () => {
    const series = await seedSeries(calendar);
    const same = await seedException(series, calendar, tuesday(1));
    const own = await seedException(series, calendar, tuesday(2), {
      title: "Excursión",
    });
    const { error } = await editor.client.rpc("update_series", {
      p_series_id: series,
      p_fields: { title: "Robótica", location: "Aula 3" },
      p_shift: NULL,
      p_drop_exceptions: false,
    });
    expect(error).toBeNull();
    const after = await rows(series);
    expect(after.find((r) => r.id === same)).toMatchObject({
      title: "Robótica",
      location: "Aula 3",
    });
    expect(after.find((r) => r.id === own)).toMatchObject({
      title: "Excursión",
      location: "Aula 3",
    });
  });

  it("update_series shifts the keys and unmoved hours with the series (plan D12)", async () => {
    const series = await seedSeries(calendar, { exdates: [tuesday(3)] });
    const unmoved = await seedException(series, calendar, tuesday(1));
    const moved = await seedException(series, calendar, tuesday(2), {
      starts_at: "2026-11-18T09:00:00Z",
      ends_at: "2026-11-18T10:00:00Z",
    });
    const { error } = await owner.client.rpc("update_series", {
      p_series_id: series,
      p_fields: {
        starts_at: "2026-11-03T18:00:00Z",
        ends_at: "2026-11-03T19:00:00Z",
      },
      p_shift: "1 hour",
      p_drop_exceptions: false,
    });
    expect(error).toBeNull();
    const hour = 3_600_000;
    const after = await rows(series);
    const a = after.find((r) => r.id === unmoved)!;
    expect(ms(a.original_start)).toBe(ms(tuesday(1)) + hour);
    expect(ms(a.starts_at)).toBe(ms(tuesday(1)) + hour);
    const b = after.find((r) => r.id === moved)!;
    expect(ms(b.original_start)).toBe(ms(tuesday(2)) + hour);
    expect(ms(b.starts_at)).toBe(ms("2026-11-18T09:00:00Z"));
    const row = await seriesRow(series);
    expect(ms(row!.exdates[0])).toBe(ms(tuesday(3)) + hour);
  });

  it("update_series drops exceptions and exdates on a new rule (RF-19)", async () => {
    const series = await seedSeries(calendar, { exdates: [tuesday(3)] });
    await seedException(series, calendar, tuesday(1));
    const { error } = await owner.client.rpc("update_series", {
      p_series_id: series,
      p_fields: { recurrence: "FREQ=DAILY;INTERVAL=1" },
      p_shift: NULL,
      p_drop_exceptions: true,
    });
    expect(error).toBeNull();
    expect(await rows(series)).toEqual([]);
    expect((await seriesRow(series))?.exdates).toEqual([]);
  });

  it("a series becomes a single event; the first occurrence keeps its images (RF-21, D7)", async () => {
    const plain = await seedSeries(calendar);
    await seedException(plain, calendar, tuesday(2));
    const { data: same, error } = await owner.client.rpc("update_series", {
      p_series_id: plain,
      p_fields: {
        recurrence: NULL,
        recurrence_tz: NULL,
        recurrence_until: NULL,
      },
      p_shift: NULL,
      p_drop_exceptions: true,
    });
    expect(error).toBeNull();
    expect(same).toBe(plain);
    expect(await seriesRow(plain)).toMatchObject({ recurrence: NULL });
    expect(await rows(plain)).toEqual([]);

    const withImages = await seedSeries(calendar);
    const first = await seedException(withImages, calendar, SERIES.starts_at);
    const image = await seedImageOn(first, owner.id);
    const { data: kept } = await owner.client.rpc("update_series", {
      p_series_id: withImages,
      p_fields: { recurrence: NULL, recurrence_tz: NULL, title: "Una vez" },
      p_shift: NULL,
      p_drop_exceptions: true,
    });
    expect(kept).toBe(first);
    expect(await seriesRow(withImages)).toBeNull();
    expect(await seriesRow(first)).toMatchObject({
      title: "Una vez",
      series_id: null,
      original_start: null,
    });
    const { data: images } = await admin
      .from("event_images")
      .select("id")
      .eq("id", image);
    expect(images).toHaveLength(1);
    await admin.from("event_images").delete().eq("id", image);
    await deleteQueuedImages([image]);
  });

  it("delete_occurrences by scope (RF-20)", async () => {
    const series = await seedSeries(calendar);
    await seedException(series, calendar, tuesday(1));
    await seedException(series, calendar, tuesday(4));

    const deleteAs = (user: TestUser, args: object) =>
      user.client.rpc("delete_occurrences", {
        p_series_id: series,
        p_original_start: tuesday(0),
        p_scope: "this",
        p_recurrence: NULL,
        p_until: NULL,
        ...args,
      });

    expect(
      (await deleteAs(editor, { p_original_start: tuesday(1) })).error,
    ).toBeNull();
    await deleteAs(owner, { p_original_start: tuesday(2) });
    expect((await seriesRow(series))?.exdates).toHaveLength(2);
    expect(await rows(series)).toHaveLength(1);

    await deleteAs(owner, {
      p_original_start: tuesday(3),
      p_scope: "following",
      p_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261116T235959",
      p_until: tuesday(2),
    });
    expect(await rows(series)).toEqual([]);
    expect((await seriesRow(series))?.recurrence).toContain("UNTIL");

    const { error } = await deleteAs(viewer, { p_scope: "all" });
    expect(error?.code).toBe("CF404");

    await deleteAs(owner, { p_scope: "following" });
    expect(await seriesRow(series)).toBeNull();
  });

  it("series_loss counts exceptions and ready images (RF-19, RF-24b)", async () => {
    const series = await seedSeries(calendar);
    const a = await seedException(series, calendar, tuesday(1));
    const b = await seedException(series, calendar, tuesday(3));
    const images = [
      await seedImageOn(a, owner.id),
      await seedImageOn(b, owner.id),
      await seedImageOn(b, editor.id),
    ];

    const loss = async (args: object) =>
      (
        await viewer.client.rpc("series_loss", {
          p_series_id: series,
          ...args,
        })
      ).data;
    expect(await loss({})).toEqual([{ exceptions: 2, images: 3 }]);
    expect(await loss({ p_from: tuesday(2) })).toEqual([
      { exceptions: 1, images: 2 },
    ]);
    expect(await loss({ p_only: tuesday(1) })).toEqual([
      { exceptions: 1, images: 1 },
    ]);
    await admin.from("event_images").delete().in("id", images);
    await deleteQueuedImages(images);
  });

  it("an editor who lost the role is refused", async () => {
    const lost = await createTestUser({ display_name: "Ex" });
    try {
      await admin
        .from("calendar_members")
        .insert({ calendar_id: calendar, user_id: lost.id, role: "editor" });
      const series = await seedSeries(calendar);
      await admin
        .from("calendar_members")
        .update({ role: "viewer" })
        .eq("calendar_id", calendar)
        .eq("user_id", lost.id);
      const { error } = await lost.client.rpc("update_series", {
        p_series_id: series,
        p_fields: { title: "x" },
        p_shift: NULL,
        p_drop_exceptions: false,
      });
      expect(error?.code).toBe("CF404");
    } finally {
      await deleteTestUser(lost.id);
    }
  });
});
