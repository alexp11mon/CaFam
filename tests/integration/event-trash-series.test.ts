import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteQueuedImages,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 046, T2: series in the trash (RF-2, RF-5, RF-8).
let owner: TestUser;
let editor: TestUser;
let calendar: string;
const objectIds: string[] = [];

const SERIES = {
  title: "Clase de inglés",
  starts_at: "2026-11-03T17:00:00Z",
  ends_at: "2026-11-03T18:00:00Z",
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=10",
  recurrence_tz: "Europe/Madrid",
  recurrence_until: "2027-01-05T18:00:00Z",
};
const SECOND = "2026-11-10T17:00:00Z";
const FOURTH = "2026-11-24T17:00:00Z";

beforeAll(async () => {
  [owner, editor] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Eva" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendar, user_id: editor.id, role: "editor" });
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all([owner, editor].map((user) => deleteTestUser(user.id)));
  await deleteQueuedImages(objectIds);
  await deleteTestMail();
});

/** A series with a changed occurrence (and its image and comment). */
async function seedSeries() {
  const { data: series, error } = await admin
    .from("events")
    .insert({ calendar_id: calendar, created_by: owner.id, ...SERIES })
    .select("id")
    .single();
  if (error) throw error;
  const exceptions = [];
  for (const start of [SECOND, FOURTH]) {
    const { data, error: exceptionError } = await admin
      .from("events")
      .insert({
        calendar_id: calendar,
        created_by: owner.id,
        title: "Clase de inglés (aula 2)",
        starts_at: start,
        ends_at: new Date(Date.parse(start) + 3_600_000).toISOString(),
        series_id: series.id,
        original_start: start,
      })
      .select("id")
      .single();
    if (exceptionError) throw exceptionError;
    exceptions.push(data.id);
  }
  const objectId = randomUUID();
  objectIds.push(objectId);
  await admin.from("event_images").insert({
    event_id: exceptions[1],
    object_id: objectId,
    uploaded_by: owner.id,
    status: "ready",
    bytes: 1000,
    width: 10,
    height: 10,
  });
  await admin.from("event_comments").insert({
    event_id: exceptions[1],
    author_id: owner.id,
    body: "Traed el libro",
    client_id: randomUUID(),
  });
  return { id: series.id, exceptions };
}

async function exceptionsOf(seriesId: string) {
  const { data } = await admin
    .from("events")
    .select("id")
    .eq("series_id", seriesId);
  return (data ?? []).map((row) => row.id).sort();
}

async function trashed(trashId: string) {
  const { data } = await editor.client.rpc("trash_list");
  return (data ?? []).find((row) => row.id === trashId);
}

describe("a whole series (RF-2)", () => {
  it("goes to the trash as one entry and comes back with everything", async () => {
    const series = await seedSeries();
    const { data: trashId, error } = await editor.client.rpc(
      "snapshot_series",
      { p_series_id: series.id, p_occurrences: 10 },
    );
    expect(error).toBeNull();
    const deleted = await editor.client.rpc("delete_occurrences", {
      p_series_id: series.id,
      p_original_start: SECOND,
      p_scope: "all",
      p_recurrence: null as unknown as string,
      p_until: null as unknown as string,
    });
    expect(deleted.error).toBeNull();

    expect(await trashed(trashId!)).toMatchObject({
      kind: "series",
      title: "Clase de inglés",
      occurrences: 10,
      images: 1,
      comments: 1,
      original_start: null,
    });

    const restored = await owner.client.rpc("restore_event", {
      p_trash_id: trashId!,
    });
    expect(restored.error).toBeNull();
    expect(restored.data).toBe(series.id);
    expect(await exceptionsOf(series.id)).toEqual(
      [...series.exceptions].sort(),
    );
    const { count: images } = await admin
      .from("event_images")
      .select("id", { count: "exact", head: true })
      .eq("event_id", series.exceptions[1]);
    expect(images).toBe(1);
    const { count: comments } = await admin
      .from("event_comments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", series.exceptions[1]);
    expect(comments).toBe(1);
  });
});

describe("este y los siguientes (RF-2)", () => {
  it("restores the series as it was before the cut", async () => {
    const series = await seedSeries();
    const { data: trashId } = await editor.client.rpc("snapshot_series", {
      p_series_id: series.id,
      p_from: FOURTH,
    });
    const cut = await editor.client.rpc("delete_occurrences", {
      p_series_id: series.id,
      p_original_start: FOURTH,
      p_scope: "following",
      p_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;UNTIL=20261117T170000Z",
      p_until: "2026-11-17T18:00:00Z",
    });
    expect(cut.error).toBeNull();
    expect(await exceptionsOf(series.id)).toEqual([series.exceptions[0]]);
    expect(await trashed(trashId!)).toMatchObject({
      kind: "series",
      original_start: expect.stringMatching(/^2026-11-24T17:00:00/),
    });

    const { error } = await editor.client.rpc("restore_event", {
      p_trash_id: trashId!,
    });
    expect(error).toBeNull();
    const { data: row } = await admin
      .from("events")
      .select("recurrence")
      .eq("id", series.id)
      .single();
    expect(row!.recurrence).toBe(SERIES.recurrence);
    expect(await exceptionsOf(series.id)).toEqual(
      [...series.exceptions].sort(),
    );
  });
});

describe("an occurrence (RF-2, RF-5)", () => {
  it("cannot come back once its series is gone, and says why", async () => {
    const series = await seedSeries();
    const { data: trashId } = await editor.client.rpc("snapshot_event", {
      p_event_id: series.id,
      p_original_start: SECOND,
    });
    expect(await trashed(trashId!)).toMatchObject({
      kind: "occurrence",
      title: "Clase de inglés (aula 2)",
      series_id: series.id,
    });
    await admin.from("events").delete().eq("id", series.id);

    const { error } = await editor.client.rpc("restore_event", {
      p_trash_id: trashId!,
    });
    expect(error?.code).toBe("CF410");
  });
});
