import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { offlineImage, type ImageOp } from "@/app/dashboard/offline-images";
import {
  admin,
  createTestUser,
  deleteQueuedImages,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 035 T8: reserving, uploading to the signed URLs and confirming an
// image added offline, with the user's session (RF-39 to RF-41, plan D6, D7).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let ana: TestUser;
let anaCal: string;
const objects: string[] = [];

beforeAll(async () => {
  ana = await createTestUser({ display_name: "Ana" });
  anaCal = await getOwnCalendarId(ana.id);
});

afterAll(async () => {
  if (objects.length > 0) {
    await admin.storage
      .from("event-images")
      .remove(objects.flatMap((id) => [`${id}/full.jpg`, `${id}/thumb.jpg`]));
    await deleteQueuedImages(objects);
  }
  if (ana) await deleteTestUser(ana.id);
  await deleteTestMail();
});

async function seedEvent() {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Cumpleaños",
      starts_at: "2026-11-20T17:00:00Z",
      ends_at: "2026-11-20T20:00:00Z",
      created_by: ana.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
  type: "image/jpeg",
});
const reserve = (eventId: string, reservedId?: string): ImageOp => ({
  op: "reserve",
  eventId,
  image: { bytes: JPEG.size * 2, width: 100, height: 80 },
  ...(reservedId ? { reservedId } : {}),
});

type Reserved = {
  id: string;
  uploads: Record<"full" | "thumb", { url: string | null; path: string }>;
};

async function reserved(eventId: string, reservedId?: string) {
  const answer = await offlineImage(ana.client, reserve(eventId, reservedId));
  expect(answer.status).toBe(200);
  const body = answer.body as Reserved;
  objects.push(body.uploads.full.path.split("/")[0]!);
  return body;
}

const put = (url: string | null) =>
  fetch(url ?? "", {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg", "x-upsert": "false" },
    body: JPEG,
  });

const pendingCount = async (eventId: string) =>
  (
    await admin
      .from("event_images")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
  ).count;

describe("reserve, upload and confirm (RF-39, RF-40)", () => {
  it("uploads to the signed URLs and the image is ready", async () => {
    const eventId = await seedEvent();
    const { id, uploads } = await reserved(eventId);
    expect((await put(uploads.full.url)).ok).toBe(true);
    expect((await put(uploads.thumb.url)).ok).toBe(true);
    expect(await offlineImage(ana.client, { op: "confirm", id })).toEqual({
      status: 200,
      body: {},
    });
    const { data } = await admin
      .from("event_images")
      .select("status, uploaded_by")
      .eq("id", id)
      .single();
    expect(data).toEqual({ status: "ready", uploaded_by: ana.id });
  });

  it("after a cut, a pending reservation is reused: one image in the end (RF-41)", async () => {
    const eventId = await seedEvent();
    const first = await reserved(eventId);
    expect((await put(first.uploads.full.url)).ok).toBe(true);
    // The connection drops before the thumbnail: the retry reuses it.
    const again = await reserved(eventId, first.id);
    expect(again.id).toBe(first.id);
    // The full image is already there: nothing to sign for it.
    expect(again.uploads.full.url).toBeNull();
    expect((await put(again.uploads.thumb.url)).ok).toBe(true);
    expect(
      (await offlineImage(ana.client, { op: "confirm", id: first.id })).status,
    ).toBe(200);
    expect(await pendingCount(eventId)).toBe(1);
  });

  it("confirming with an object missing is 409", async () => {
    const eventId = await seedEvent();
    const { id } = await reserved(eventId);
    expect((await offlineImage(ana.client, { op: "confirm", id })).status).toBe(
      409,
    );
  });
});

describe("refused (RF-41)", () => {
  it("429 with the limit of always", async () => {
    const eventId = await seedEvent();
    const rows = Array.from({ length: 10 }, () => ({
      event_id: eventId,
      object_id: randomUUID(),
      uploaded_by: ana.id,
      status: "ready",
      bytes: 10,
      width: 10,
      height: 10,
    }));
    objects.push(...rows.map((row) => row.object_id));
    const seeded = await admin.from("event_images").insert(rows);
    if (seeded.error) throw seeded.error;
    expect(await offlineImage(ana.client, reserve(eventId))).toEqual({
      status: 429,
      body: { error: "Este evento ya tiene 10 imágenes." },
    });
  });

  it("404 when the event is gone, or the reservation was purged", async () => {
    const gone = await seedEvent();
    await admin.from("events").delete().eq("id", gone);
    expect((await offlineImage(ana.client, reserve(gone))).status).toBe(404);

    const eventId = await seedEvent();
    const { id } = await reserved(eventId);
    await admin.from("event_images").delete().eq("id", id);
    expect((await offlineImage(ana.client, { op: "confirm", id })).status).toBe(
      404,
    );
  });
});
