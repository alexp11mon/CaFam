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
  type TypedClient,
} from "./helpers";

// Spec 012, T3: the private bucket and its permissions (plan "Bucket
// event-images", D5, D6; RF-25, RF-26, RF-30).
const BUCKET = "event-images";
let owner: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;
const paths: string[] = [];
const objectIds: string[] = [];

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

beforeAll(async () => {
  [owner, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Olga" }),
    createTestUser({ display_name: "Vic" }),
    createTestUser({ display_name: "Sam" }),
  ]);
  calendar = await getOwnCalendarId(owner.id);
  const { error } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendar, user_id: viewer.id, role: "viewer" });
  if (error) throw error;
});

afterAll(async () => {
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  await Promise.all(
    [owner, viewer, stranger]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
  await deleteQueuedImages(objectIds);
});

function jpeg(bytes = 2000, type = "image/jpeg") {
  return new Blob([new Uint8Array(bytes).fill(7)], { type });
}

async function createEvent(calendarId: string) {
  const { data, error } = await admin
    .from("events")
    .insert({ calendar_id: calendarId, title: "Cumpleaños", ...TIMES })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function reserve(user: TestUser, eventId: string) {
  const { data, error } = await user.client.rpc("reserve_event_images", {
    p_event_id: eventId,
    p_images: [{ bytes: 4000, width: 2048, height: 1536 }],
  });
  if (error) throw error;
  objectIds.push(data[0]);
  return data[0];
}

async function upload(client: TypedClient, path: string, blob = jpeg()) {
  paths.push(path);
  return client.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
}

/** Reserves, uploads both objects and confirms: a ready image. */
async function readyImage(user: TestUser, eventId: string) {
  const id = await reserve(user, eventId);
  for (const variant of ["full", "thumb"]) {
    const { error } = await upload(user.client, `${id}/${variant}.jpg`);
    if (error) throw error;
  }
  const { error } = await user.client.rpc("confirm_event_image", { p_id: id });
  if (error) throw error;
  return id;
}

// What the app does (plan D5): Supabase's CDN caches downloads per URL and
// token (storage.download() kept serving an expelled member), so every request
// carries a unique query and RLS runs each time.
async function canDownload(client: TypedClient, path: string) {
  const { data } = await client.auth.getSession();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${path}?v=${randomUUID()}`,
    {
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${data.session?.access_token ?? key}`,
      },
    },
  );
  return response.ok;
}

describe("uploading (RF-25)", () => {
  it("only to an own reservation, with the two expected names", async () => {
    const event = await createEvent(calendar);
    const loose = randomUUID();
    expect((await upload(owner.client, `${loose}/full.jpg`)).error).not.toBe(
      null,
    );

    const id = await reserve(viewer, event);
    expect((await upload(owner.client, `${id}/full.jpg`)).error).not.toBe(null);
    expect((await upload(viewer.client, `${id}/other.jpg`)).error).not.toBe(
      null,
    );
    expect((await upload(viewer.client, `${id}/full.jpg`)).error).toBeNull();
    expect((await upload(viewer.client, `${id}/thumb.jpg`)).error).toBeNull();
  });

  it("rejects a type other than JPEG and objects over 4 MB", async () => {
    const event = await createEvent(calendar);
    const id = await reserve(owner, event);
    const png = await upload(
      owner.client,
      `${id}/full.jpg`,
      jpeg(100, "image/png"),
    );
    expect(png.error).not.toBe(null);
    const big = await upload(
      owner.client,
      `${id}/thumb.jpg`,
      jpeg(4 * 1024 * 1024 + 1),
    );
    expect(big.error).not.toBe(null);
  });
});

describe("confirming (RF-2)", () => {
  it("marks the image ready with the real size of both objects", async () => {
    const id = await readyImage(owner, await createEvent(calendar));
    const { data } = await admin
      .from("event_images")
      .select("status, bytes")
      .eq("id", id)
      .single();
    expect(data).toEqual({ status: "ready", bytes: 4000 });
  });
});

describe("downloading (RF-25, RF-26, RF-30)", () => {
  it("members download; strangers and anon do not, even knowing the path", async () => {
    const id = await readyImage(owner, await createEvent(calendar));
    const path = `${id}/thumb.jpg`;

    expect(await canDownload(owner.client, path)).toBe(true);
    expect(await canDownload(viewer.client, path)).toBe(true);
    expect(await canDownload(stranger.client, path)).toBe(false);
    expect(await canDownload(anonClient(), path)).toBe(false);
  });

  it("an expelled viewer stops downloading on the next request", async () => {
    const lola = await createTestUser({ display_name: "Lola" });
    try {
      await admin
        .from("calendar_members")
        .insert({ calendar_id: calendar, user_id: lola.id, role: "viewer" });
      const id = await readyImage(owner, await createEvent(calendar));
      const path = `${id}/full.jpg`;
      expect(await canDownload(lola.client, path)).toBe(true);

      const { error } = await owner.client
        .from("calendar_members")
        .delete()
        .eq("calendar_id", calendar)
        .eq("user_id", lola.id);
      expect(error).toBeNull();
      expect(await canDownload(lola.client, path)).toBe(false);
    } finally {
      await deleteTestUser(lola.id);
    }
  });

  it("moving the event applies the privacy of the new calendar", async () => {
    const { data: other } = await admin
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Trabajo" })
      .select("id")
      .single();
    const event = await createEvent(calendar);
    const id = await readyImage(owner, event);
    await owner.client
      .from("events")
      .update({ calendar_id: other!.id })
      .eq("id", event);

    expect(await canDownload(owner.client, `${id}/thumb.jpg`)).toBe(true);
    expect(await canDownload(viewer.client, `${id}/thumb.jpg`)).toBe(false);
  });

  it("a pending image cannot be downloaded by other members", async () => {
    const event = await createEvent(calendar);
    const id = await reserve(owner, event);
    await upload(owner.client, `${id}/full.jpg`);
    expect(await canDownload(viewer.client, `${id}/full.jpg`)).toBe(false);
  });
});

describe("removing objects (plan D7)", () => {
  it("only objects claimed from the purge queue can be removed", async () => {
    const id = await readyImage(owner, await createEvent(calendar));
    const path = `${id}/thumb.jpg`;
    const remove = () =>
      anonClient()
        .storage.from(BUCKET)
        .remove([path, `${id}/full.jpg`]);

    const { data: refused } = await owner.client.storage
      .from(BUCKET)
      .remove([path]);
    expect(refused ?? []).toEqual([]);
    expect(await canDownload(owner.client, path)).toBe(true);

    // Queued but not claimed: still protected.
    await owner.client.from("event_images").delete().eq("id", id);
    expect((await remove()).data ?? []).toEqual([]);
    expect(await canDownload(anonClient(), path)).toBe(false);

    // Claimed by the purge (T5 does it with the secret): removable for a while.
    await admin
      .from("image_purge_queue")
      .update({ claimed_at: new Date().toISOString() })
      .eq("object_id", id);
    expect((await remove()).data).toHaveLength(2);
  });
});
