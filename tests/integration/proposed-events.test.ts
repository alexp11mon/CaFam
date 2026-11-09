import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkRows,
  createRows,
} from "@/app/dashboard/assistant/proposal-writes";
import type { ProposalRow } from "@/lib/assistant/schemas";
import {
  admin,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 022, T7: the proposal is created with the user's session, so RLS
// decides (RF-36, RF-38, RF-39, RF-40, RF-43, RF-46; plan D5, D8).
const TZ = "Europe/Madrid";

let ana: TestUser;
let luis: TestUser;
let sam: TestUser;
let anaCal: string;
let luisCal: string; // Ana is an editor
let samCal: string; // Ana is a reader

function row(over: Partial<ProposalRow>): ProposalRow {
  return {
    key: "r1",
    title: "Turno",
    startDate: "2026-12-07",
    start: "08:00",
    endDate: "2026-12-07",
    end: "15:00",
    allDay: false,
    calendarId: anaCal,
    selected: true,
    duplicate: false,
    ...over,
  };
}

beforeAll(async () => {
  [ana, luis, sam] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  [anaCal, luisCal, samCal] = await Promise.all(
    [ana, luis, sam].map((u) => getOwnCalendarId(u.id)),
  );
  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: luisCal, user_id: ana.id, role: "editor" },
    { calendar_id: samCal, user_id: ana.id, role: "viewer" },
  ]);
  if (error) throw error;
  // A daily series 08:00-15:00 in Madrid: its occurrences have no rows.
  const { error: seriesError } = await admin.from("events").insert({
    calendar_id: anaCal,
    title: "Serie",
    starts_at: "2026-12-01T07:00:00Z",
    ends_at: "2026-12-01T14:00:00Z",
    recurrence: "FREQ=DAILY;COUNT=5",
    recurrence_tz: TZ,
    recurrence_until: "2026-12-05T14:00:00Z",
    created_by: ana.id,
  });
  if (seriesError) throw seriesError;
});

afterAll(async () => {
  for (const user of [ana, luis, sam]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

describe("createRows", () => {
  it("creates the selected rows in each calendar Ana can write to", async () => {
    const results = await createRows(ana.client, ana.id, TZ, [
      row({ key: "own" }),
      row({
        key: "skipped",
        selected: false,
        startDate: "2026-12-08",
        endDate: "2026-12-08",
      }),
      row({ key: "editor", calendarId: luisCal }),
      row({ key: "reader", calendarId: samCal }),
      row({
        key: "night",
        startDate: "2026-12-12",
        start: "22:00",
        endDate: "2026-12-13",
        end: "06:00",
      }),
    ]);
    expect(results.map((r) => [r.key, r.ok])).toEqual([
      ["own", true],
      ["editor", true],
      ["reader", false],
      ["night", true],
    ]);
    expect(results[2]).toMatchObject({
      error: "No tienes permiso para hacer esto.",
    });

    const { data } = await admin
      .from("events")
      .select("calendar_id, starts_at, ends_at, created_by, recurrence")
      .eq("created_by", ana.id)
      .gte("starts_at", "2026-12-06T00:00:00Z")
      .order("starts_at");
    expect(data).toEqual([
      expect.objectContaining({
        calendar_id: anaCal,
        starts_at: "2026-12-07T07:00:00+00:00",
        ends_at: "2026-12-07T14:00:00+00:00",
        recurrence: null,
      }),
      expect.objectContaining({ calendar_id: luisCal }),
      expect.objectContaining({
        starts_at: "2026-12-12T21:00:00+00:00",
        ends_at: "2026-12-13T05:00:00+00:00",
      }),
    ]);
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("calendar_id", samCal);
    expect(count).toBe(0);
  });

  it("creates a duplicate the user selected again (RF-38)", async () => {
    const results = await createRows(ana.client, ana.id, TZ, [
      row({ key: "again", duplicate: true }),
    ]);
    expect(results[0]).toMatchObject({ ok: true });
  });
});

describe("checkRows", () => {
  it("marks duplicates, also an occurrence of a series (RF-37, D8)", async () => {
    const { rows } = await checkRows(ana.client, ana.id, TZ, [
      row({ key: "created" }),
      row({
        key: "occurrence",
        startDate: "2026-12-03",
        endDate: "2026-12-03",
      }),
      row({ key: "free", startDate: "2026-12-20", endDate: "2026-12-20" }),
    ]);
    expect(rows.map((r) => [r.key, r.duplicate, r.selected])).toEqual([
      ["created", true, false],
      ["occurrence", true, false],
      ["free", false, true],
    ]);
  });

  it("flags rows in a calendar Ana can no longer write to", async () => {
    const { errors } = await checkRows(ana.client, ana.id, TZ, [
      row({ key: "reader", calendarId: samCal }),
      row({ key: "editor", calendarId: luisCal }),
    ]);
    expect(errors).toEqual({ reader: "No tienes permiso para hacer esto." });
  });
});
