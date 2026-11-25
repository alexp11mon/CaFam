import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 048, T5: notes of an event and of one repetition (RF-9 to RF-11).
let owner: TestUser;
let viewer: TestUser;
let calendar: string;
const SECRET = process.env.CRON_SECRET ?? "";

beforeAll(async () => {
  [owner, viewer] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Vic" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendar, user_id: viewer.id, role: "viewer" });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, viewer].map((u) => deleteTestUser(u.id).catch(() => {})),
  );
});

describe("a note of one repetition", () => {
  it("links to the row materialize_occurrence leaves, readers see it, and deleting the series unlinks", async () => {
    const { data: series, error } = await admin
      .from("events")
      .insert({
        calendar_id: calendar,
        title: "Extraescolar",
        starts_at: "2026-11-03T17:00:00Z",
        ends_at: "2026-11-03T18:00:00Z",
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
        recurrence_tz: "Europe/Madrid",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    const occurrence = "2026-11-10T17:00:00.000Z";
    // Any member materializes it, the viewer too (as images and comments).
    const { data: row, error: rowError } = await viewer.client.rpc(
      "materialize_occurrence",
      {
        p_secret: SECRET,
        p_series_id: series!.id,
        p_original_start: occurrence,
      },
    );
    expect(rowError).toBeNull();
    expect(row).not.toBe(series!.id);

    const { data: note, error: noteError } = await owner.client
      .from("notes")
      .insert({ title: "Material", calendar_id: calendar, event_id: row! })
      .select("id")
      .single();
    expect(noteError).toBeNull();

    // Only that repetition has it.
    const { data: ofRow } = await viewer.client
      .from("notes")
      .select("id")
      .eq("event_id", row!);
    expect(ofRow?.map((n) => n.id)).toEqual([note!.id]);
    const { data: ofSeries } = await viewer.client
      .from("notes")
      .select("id")
      .eq("event_id", series!.id);
    expect(ofSeries).toEqual([]);

    // The series and its rows go; the note stays, unlinked (RF-11).
    await admin.from("events").delete().eq("series_id", series!.id);
    await admin.from("events").delete().eq("id", series!.id);
    const { data: after } = await admin
      .from("notes")
      .select("event_id")
      .eq("id", note!.id)
      .single();
    expect(after).toEqual({ event_id: null });
  });
});
