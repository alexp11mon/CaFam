import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyChange } from "@/app/dashboard/offline-writes";
import type { EventData } from "@/lib/calendar/schemas";
import type { SeriesBase } from "@/lib/offline/outbox";
import { offlineChangeSchema, type ParsedChange } from "@/lib/offline/schemas";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 035 T7: changes of a series made offline, in the three scopes, with
// what forcing them would lose (RF-10, RF-11, RF-14, RF-15, plan D3).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const TZ = "Europe/Madrid";
const RULE = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=4";

let ana: TestUser;
let luis: TestUser;
let anaCal: string;

beforeAll(async () => {
  [ana, luis] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
  ]);
  anaCal = await getOwnCalendarId(ana.id);
  const member = await admin
    .from("calendar_members")
    .insert({ calendar_id: anaCal, user_id: luis.id, role: "editor" });
  if (member.error) throw member.error;
});

afterAll(async () => {
  for (const user of [ana, luis]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

const fields = (extra: Partial<EventData> = {}): EventData => ({
  title: "Inglés",
  calendarId: anaCal,
  allDay: false,
  startsAt: "2026-11-23T17:00:00+00:00",
  endsAt: "2026-11-23T18:00:00+00:00",
  description: null,
  location: null,
  color: null,
  categoryId: null,
  ...extra,
});

/** Mondays 23 Nov to 14 Dec 2026, 18:00 in Madrid. */
async function seedSeries() {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Inglés",
      starts_at: "2026-11-23T17:00:00Z",
      ends_at: "2026-11-23T18:00:00Z",
      created_by: ana.id,
      recurrence: RULE,
      recurrence_tz: TZ,
      recurrence_until: "2026-12-14T18:00:00Z",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const base = (extra: Partial<SeriesBase> = {}): SeriesBase => ({
  fields: fields(),
  recurrence: RULE,
  exdates: [],
  totals: { exceptions: 0, images: 0, comments: 0, latest: null },
  ...extra,
});

const occurrence = (seriesId: string, day: string) =>
  occurrenceId(seriesId, `${day}T17:00:00.000Z`);

const apply = (user: TestUser, change: unknown, force = false) =>
  applyChange(
    user.client,
    user.id,
    TZ,
    offlineChangeSchema.parse(change) as ParsedChange,
    force,
  );

const rowsOf = async (seriesId: string) =>
  (
    await admin
      .from("events")
      .select("id, title, starts_at, recurrence, exdates, series_id")
      .or(`id.eq.${seriesId},series_id.eq.${seriesId}`)
      .order("starts_at")
  ).data ?? [];

describe("scopes (RF-10, RF-15)", () => {
  it("'Todos los eventos' moves the whole series", async () => {
    const seriesId = await seedSeries();
    const result = await apply(ana, {
      type: "series.update",
      id: occurrence(seriesId, "2026-11-30"),
      scope: "all",
      base: base(),
      data: fields({
        title: "Inglés B2",
        startsAt: "2026-11-30T18:00:00+00:00",
        endsAt: "2026-11-30T19:00:00+00:00",
      }),
      repeat: `custom:${RULE}`,
    });
    expect(result).toEqual({ status: "applied" });
    const rows = await rowsOf(seriesId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: "Inglés B2",
      starts_at: expect.stringMatching(/^2026-11-23T18:00:00/),
    });
  });

  it("'Este y los siguientes' splits the series at that occurrence", async () => {
    const seriesId = await seedSeries();
    const result = await apply(ana, {
      type: "series.update",
      id: occurrence(seriesId, "2026-12-07"),
      scope: "following",
      base: base(),
      data: fields({
        title: "Inglés (aula nueva)",
        startsAt: "2026-12-07T17:00:00+00:00",
        endsAt: "2026-12-07T18:00:00+00:00",
      }),
      repeat: `custom:${RULE}`,
    });
    expect(result).toEqual({ status: "applied" });
    const { data: split } = await admin
      .from("events")
      .select("title, starts_at")
      .eq("calendar_id", anaCal)
      .eq("title", "Inglés (aula nueva)")
      .not("recurrence", "is", null);
    expect(split).toEqual([
      expect.objectContaining({
        starts_at: expect.stringMatching(/^2026-12-07/),
      }),
    ]);
  });

  it("deletes 'Este y los siguientes' and 'Todos los eventos'", async () => {
    const seriesId = await seedSeries();
    expect(
      await apply(ana, {
        type: "series.delete",
        id: occurrence(seriesId, "2026-12-07"),
        scope: "following",
        base: base(),
      }),
    ).toEqual({ status: "applied" });
    const [row] = await rowsOf(seriesId);
    expect(row?.recurrence).not.toBe(RULE);

    const other = await seedSeries();
    expect(
      await apply(ana, {
        type: "series.delete",
        id: occurrence(other, "2026-11-30"),
        scope: "all",
        base: base(),
      }),
    ).toEqual({ status: "applied" });
    expect(await rowsOf(other)).toEqual([]);
  });
});

describe("create and convert (RF-11)", () => {
  it("creates a series with the browser's id, and a resend is still one", async () => {
    const id = randomUUID();
    const change = {
      type: "event.create",
      id,
      data: fields({ title: "Piscina" }),
      repeat: "weekly",
    };
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    expect(await apply(ana, change)).toEqual({ status: "applied" });
    const { data } = await admin
      .from("events")
      .select("recurrence, recurrence_tz")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      recurrence: expect.stringContaining("FREQ=WEEKLY"),
      recurrence_tz: TZ,
    });
  });

  it("converts a single event with 'repeat'", async () => {
    const { data: single, error } = await admin
      .from("events")
      .insert({
        calendar_id: anaCal,
        title: "Inglés",
        starts_at: "2026-11-23T17:00:00Z",
        ends_at: "2026-11-23T18:00:00Z",
        created_by: ana.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    const result = await apply(ana, {
      type: "event.update",
      id: single.id,
      base: fields(),
      data: fields(),
      repeat: "daily",
    });
    expect(result).toEqual({ status: "applied" });
    const { data } = await admin
      .from("events")
      .select("recurrence")
      .eq("id", single.id)
      .single();
    expect(data?.recurrence).toContain("FREQ=DAILY");
  });
});

describe("conflicts (RF-14)", () => {
  it("a series changed by another asks with it and what forcing would lose", async () => {
    const seriesId = await seedSeries();
    await admin
      .from("events")
      .update({ title: "Inglés (Luis)" })
      .eq("id", seriesId);
    const change = {
      type: "series.update",
      id: occurrence(seriesId, "2026-11-30"),
      scope: "all",
      base: base(),
      data: fields({ title: "Mío" }),
      repeat: `custom:${RULE}`,
    };
    const result = await apply(ana, change);
    expect(result).toEqual({
      status: "conflict",
      server: expect.objectContaining({
        title: "Inglés (Luis)",
        recurrence: RULE,
        totals: expect.objectContaining({ exceptions: 0 }),
        loss: null,
      }),
    });
    expect(await apply(ana, change, true)).toEqual({ status: "applied" });
    expect((await rowsOf(seriesId))[0]).toMatchObject({ title: "Mío" });
  });

  it("a comment added by another in the series asks, counting what would go", async () => {
    const seriesId = await seedSeries();
    // Luis comments one occurrence: it gets its own row (spec 014 RF-28).
    const { data: row, error } = await luis.client.rpc(
      "materialize_occurrence",
      {
        p_secret: process.env.CRON_SECRET ?? "",
        p_series_id: seriesId,
        p_original_start: "2026-12-07T17:00:00.000Z",
      },
    );
    if (error) throw error;
    const comment = await luis.client
      .from("event_comments")
      .insert({ event_id: row, body: "No vengo", client_id: randomUUID() });
    if (comment.error) throw comment.error;

    const result = await apply(ana, {
      type: "series.update",
      id: occurrence(seriesId, "2026-11-30"),
      scope: "all",
      base: base(),
      // A new rule drops the exceptions, and their comments with them.
      data: fields(),
      repeat: "daily",
    });
    expect(result).toEqual({
      status: "conflict",
      server: expect.objectContaining({
        totals: expect.objectContaining({ exceptions: 1, comments: 1 }),
        loss: { exceptions: 1, images: 0, comments: 1 },
      }),
    });
  });

  it("a series deleted by another: a change asks, a delete is done", async () => {
    const seriesId = await seedSeries();
    await admin.from("events").delete().eq("id", seriesId);
    const id = occurrence(seriesId, "2026-11-30");
    expect(
      await apply(ana, {
        type: "series.update",
        id,
        scope: "all",
        base: base(),
        data: fields({ title: "Mío" }),
        repeat: `custom:${RULE}`,
      }),
    ).toEqual({ status: "conflict", server: null });
    expect(
      await apply(ana, {
        type: "series.delete",
        id,
        scope: "all",
        base: base(),
      }),
    ).toEqual({ status: "applied" });
  });
});
