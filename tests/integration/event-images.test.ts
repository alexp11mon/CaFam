import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 012, T1: event_images, its policies and the purge queue (plan
// "Modelo de datos"; RF-4, RF-15 to RF-17, RF-19, RF-29, RF-30).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;
const objectIds: string[] = [];
const extraUsers: string[] = [];

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
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
  await admin.from("image_purge_queue").delete().in("object_id", objectIds);
  await deleteTestMail();
  await Promise.all(
    [owner, editor, viewer, stranger, ...extraUsers.map((id) => ({ id }))]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
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

async function createEvent(calendarId: string, title = "Cumpleaños") {
  const { data, error } = await admin
    .from("events")
    .insert({ calendar_id: calendarId, title, ...TIMES })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Seeds a row as the reserve/confirm functions would leave it. */
async function seedImage(
  eventId: string,
  uploadedBy: string | null,
  options: { status?: "pending" | "ready"; objectId?: string } = {},
) {
  const id = randomUUID();
  const objectId = options.objectId ?? id;
  objectIds.push(objectId);
  const { error } = await admin.from("event_images").insert({
    id,
    event_id: eventId,
    object_id: objectId,
    uploaded_by: uploadedBy,
    status: options.status ?? "ready",
    bytes: 1000,
    width: 2048,
    height: 1536,
  });
  if (error) throw error;
  return { id, objectId };
}

async function visibleTo(user: TestUser, imageId: string) {
  const { data } = await user.client
    .from("event_images")
    .select("id")
    .eq("id", imageId);
  return (data ?? []).length === 1;
}

async function rowExists(imageId: string) {
  const { data } = await admin
    .from("event_images")
    .select("id")
    .eq("id", imageId);
  return (data ?? []).length === 1;
}

async function queued(objectId: string) {
  const { data } = await admin
    .from("image_purge_queue")
    .select("object_id, bytes")
    .eq("object_id", objectId);
  return (data ?? []).length === 1;
}

async function deleteAs(user: TestUser, imageId: string) {
  const { data, error } = await user.client
    .from("event_images")
    .delete()
    .eq("id", imageId)
    .select("id");
  expect(error).toBeNull();
  return data ?? [];
}

describe("reading event_images (RF-4, RF-25)", () => {
  it("members of the calendar read ready images; strangers and anon do not", async () => {
    const event = await createEvent(calendar);
    const { id } = await seedImage(event, editor.id);

    expect(await visibleTo(owner, id)).toBe(true);
    expect(await visibleTo(editor, id)).toBe(true);
    expect(await visibleTo(viewer, id)).toBe(true);
    expect(await visibleTo(stranger, id)).toBe(false);
    const { data } = await anonClient()
      .from("event_images")
      .select("id")
      .eq("id", id);
    expect(data ?? []).toEqual([]);
  });

  it("a pending image is only visible to who reserved it", async () => {
    const event = await createEvent(calendar);
    const { id } = await seedImage(event, viewer.id, { status: "pending" });

    expect(await visibleTo(viewer, id)).toBe(true);
    expect(await visibleTo(owner, id)).toBe(false);
    expect(await visibleTo(editor, id)).toBe(false);
  });
});

describe("writing event_images (RF-15)", () => {
  it("nobody inserts or updates rows directly", async () => {
    const event = await createEvent(calendar);
    const { id } = await seedImage(event, owner.id);

    const insert = await viewer.client.from("event_images").insert({
      event_id: event,
      object_id: randomUUID(),
      uploaded_by: viewer.id,
      bytes: 1,
      width: 1,
      height: 1,
    });
    expect(insert.error?.code).toBe("42501");
    const update = await owner.client
      .from("event_images")
      .update({ status: "pending" })
      .eq("id", id);
    expect(update.error?.code).toBe("42501");
  });

  it("the uploader, the owner and editors delete; a viewer only their own", async () => {
    const event = await createEvent(calendar);
    const byViewer = await seedImage(event, viewer.id);
    const byEditor = await seedImage(event, editor.id);
    const another = await seedImage(event, viewer.id);
    const byOwner = await seedImage(event, owner.id);

    expect(await deleteAs(viewer, byEditor.id)).toEqual([]);
    expect(await deleteAs(stranger, byViewer.id)).toEqual([]);
    expect(await deleteAs(viewer, byViewer.id)).toHaveLength(1);
    expect(await deleteAs(editor, another.id)).toHaveLength(1);
    expect(await deleteAs(owner, byEditor.id)).toHaveLength(1);
    expect(await deleteAs(editor, byOwner.id)).toHaveLength(1);
  });
});

describe("purge queue (RF-15 to RF-17)", () => {
  it("deleting an image queues its object unless another row uses it", async () => {
    const event = await createEvent(calendar);
    const copyEvent = await createEvent(calendar, "Copia");
    const original = await seedImage(event, owner.id);
    const copy = await seedImage(copyEvent, owner.id, {
      objectId: original.objectId,
    });

    await deleteAs(owner, original.id);
    expect(await queued(original.objectId)).toBe(false);
    await deleteAs(owner, copy.id);
    expect(await queued(original.objectId)).toBe(true);
  });

  it("deleting the event or the calendar queues the objects of its images", async () => {
    const event = await createEvent(calendar);
    const fromEvent = await seedImage(event, editor.id);
    await admin.from("events").delete().eq("id", event);
    expect(await rowExists(fromEvent.id)).toBe(false);
    expect(await queued(fromEvent.objectId)).toBe(true);

    const other = await createCalendar(owner.id, "Viaje");
    const fromCalendar = await seedImage(await createEvent(other), owner.id);
    await admin.from("calendars").delete().eq("id", other);
    expect(await rowExists(fromCalendar.id)).toBe(false);
    expect(await queued(fromCalendar.objectId)).toBe(true);
  });

  it("deleting the owner's account queues the images of the deleted calendars", async () => {
    const dani = await createTestUser({ display_name: "Dani" });
    extraUsers.push(dani.id);
    const image = await seedImage(
      await createEvent(await getOwnCalendarId(dani.id)),
      dani.id,
    );

    const { error } = await dani.client.rpc("delete_own_account");
    expect(error).toBeNull();
    extraUsers.splice(extraUsers.indexOf(dani.id), 1);
    expect(await rowExists(image.id)).toBe(false);
    expect(await queued(image.objectId)).toBe(true);
  });

  it("clients cannot read or write the queue", async () => {
    const { data } = await owner.client.from("image_purge_queue").select();
    expect(data ?? []).toEqual([]);
    const insert = await owner.client
      .from("image_purge_queue")
      .insert({ object_id: randomUUID(), bytes: 1 });
    expect(insert.error?.code).toBe("42501");
  });
});

describe("moving and merging keep the images (RF-29, RF-30)", () => {
  it("moving the event keeps its images with the new calendar's privacy", async () => {
    const work = await createCalendar(owner.id, "Trabajo");
    const event = await createEvent(calendar);
    const image = await seedImage(event, owner.id);

    const { error } = await owner.client
      .from("events")
      .update({ calendar_id: work })
      .eq("id", event);
    expect(error).toBeNull();
    expect(await rowExists(image.id)).toBe(true);
    expect(await visibleTo(owner, image.id)).toBe(true);
    expect(await visibleTo(viewer, image.id)).toBe(false);
  });

  it("merge_calendars keeps the images of the events it moves", async () => {
    const target = await createCalendar(owner.id, "Clases");
    const source = await createCalendar(owner.id, "Exámenes");
    const image = await seedImage(await createEvent(source), owner.id);

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [target, source],
      p_target_id: target,
    });
    expect(error).toBeNull();
    expect(await rowExists(image.id)).toBe(true);
    expect(await queued(image.objectId)).toBe(false);
    expect(await visibleTo(owner, image.id)).toBe(true);
  });
});

describe("authors that leave (RF-19)", () => {
  it("deleting the uploader's account keeps the image without author", async () => {
    const ursula = await createTestUser({ display_name: "Úrsula" });
    extraUsers.push(ursula.id);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: calendar, user_id: ursula.id, role: "viewer" });
    const image = await seedImage(await createEvent(calendar), ursula.id);

    const { error } = await ursula.client.rpc("delete_own_account");
    expect(error).toBeNull();
    extraUsers.splice(extraUsers.indexOf(ursula.id), 1);
    const { data } = await admin
      .from("event_images")
      .select("uploaded_by")
      .eq("id", image.id)
      .single();
    expect(data).toEqual({ uploaded_by: null });
    expect(await visibleTo(owner, image.id)).toBe(true);
  });
});

// Spec 012, T2: reserve_event_images and confirm_event_image (plan
// "Contratos"; RF-2, RF-4, RF-8, RF-20, RF-22, RF-23).
const IMAGE = { bytes: 300_000, width: 2048, height: 1536 };

function images(count: number) {
  return Array.from({ length: count }, () => IMAGE);
}

async function reserve(user: TestUser, eventId: string, count: number) {
  const result = await user.client.rpc("reserve_event_images", {
    p_event_id: eventId,
    p_images: images(count),
  });
  objectIds.push(...(result.data ?? []));
  return result;
}

async function seedMany(eventId: string, uploadedBy: string, count: number) {
  const rows = Array.from({ length: count }, () => {
    const id = randomUUID();
    objectIds.push(id);
    return {
      id,
      event_id: eventId,
      object_id: id,
      uploaded_by: uploadedBy,
      status: "ready",
      bytes: 1000,
      width: 10,
      height: 10,
    };
  });
  const { error } = await admin.from("event_images").insert(rows);
  if (error) throw error;
  return rows;
}

describe("reserve_event_images (RF-2, RF-4, RF-8, RF-20)", () => {
  it("any member reserves, viewers included; strangers get CF404", async () => {
    const event = await createEvent(calendar);
    const { data, error } = await reserve(viewer, event, 2);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    const { data: rows } = await admin
      .from("event_images")
      .select("status, uploaded_by, object_id, id")
      .in("id", data!);
    expect(rows!.every((r) => r.status === "pending")).toBe(true);
    expect(rows!.every((r) => r.uploaded_by === viewer.id)).toBe(true);
    expect(rows!.every((r) => r.object_id === r.id)).toBe(true);

    expect((await reserve(stranger, event, 1)).error?.code).toBe("CF404");
    expect((await reserve(owner, randomUUID(), 1)).error?.code).toBe("CF404");
  });

  it("a viewer reserves in a synced calendar too (RF-8)", async () => {
    const synced = await createCalendar(owner.id, "Google");
    const { data: connection, error } = await admin
      .from("calendar_connections")
      .insert({
        owner_id: owner.id,
        provider: "google",
        account_subject: `sub-${randomUUID()}`,
        account_email: "owner@gmail.test",
      })
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("synced_calendars").insert({
      calendar_id: synced,
      connection_id: connection.id,
      provider: "google",
      external_id: "primary",
    });
    await admin
      .from("calendar_members")
      .insert({ calendar_id: synced, user_id: viewer.id, role: "viewer" });
    const { data: event } = await admin
      .from("events")
      .insert({
        calendar_id: synced,
        title: "Traído",
        external_id: "g1",
        ...TIMES,
      })
      .select("id")
      .single();

    const { data, error: reserveError } = await reserve(viewer, event!.id, 1);
    expect(reserveError).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("rejects 0 or more than 10 images and invalid sizes", async () => {
    const event = await createEvent(calendar);
    expect((await reserve(owner, event, 0)).error?.code).toBe("22023");
    expect((await reserve(owner, event, 11)).error?.code).toBe("22023");
    const { error } = await owner.client.rpc("reserve_event_images", {
      p_event_id: event,
      p_images: [{ bytes: 10, width: 4000, height: 10 }],
    });
    expect(error?.code).toBe("22023");
  });

  it("reserves only what fits in the event and fails when it is full (RF-20)", async () => {
    const event = await createEvent(calendar);
    await seedMany(event, owner.id, 8);
    const { data } = await reserve(editor, event, 5);
    expect(data).toHaveLength(2);
    const full = await reserve(editor, event, 1);
    expect(full.error?.code).toBe("CF429");
    expect(full.error?.message).toBe("event");
  });

  it("two reservations at the same time never pass 10", async () => {
    const event = await createEvent(calendar);
    const results = await Promise.all([
      reserve(owner, event, 6),
      reserve(editor, event, 6),
    ]);
    const reserved = results.reduce((n, r) => n + (r.data?.length ?? 0), 0);
    expect(reserved).toBe(10);
    const { count } = await admin
      .from("event_images")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event);
    expect(count).toBe(10);
  });
});

describe("reserve_event_images per user and in total (RF-22, RF-23)", () => {
  it("stops at 300 own images, counting shared copies once", async () => {
    const rita = await createTestUser({ display_name: "Rita" });
    extraUsers.push(rita.id);
    const ritaCalendar = await getOwnCalendarId(rita.id);
    const events = await Promise.all(
      Array.from({ length: 30 }, () => createEvent(ritaCalendar)),
    );
    const seeded = (
      await Promise.all(events.map((e) => seedMany(e, rita.id, 10)))
    ).flat();
    const spare = await createEvent(ritaCalendar);

    const over = await reserve(rita, spare, 1);
    expect(over.error?.code).toBe("CF429");
    expect(over.error?.message).toBe("user");

    // Replace one image by a copy of another: still 299 distinct objects.
    await admin.from("event_images").delete().eq("id", seeded[0].id);
    await admin
      .from("image_purge_queue")
      .delete()
      .eq("object_id", seeded[0].id);
    await admin.from("event_images").insert({
      event_id: events[0],
      object_id: seeded[1].object_id,
      uploaded_by: rita.id,
      status: "ready",
      bytes: 1000,
      width: 10,
      height: 10,
    });
    const { data, error } = await reserve(rita, spare, 1);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("refuses new images when the project space is full", async () => {
    const { data: limit } = await admin.rpc("images_total_limit");
    expect(limit).toBe(838860800);
    const event = await createEvent(calendar);
    const big = await seedImage(event, owner.id);
    await admin
      .from("event_images")
      .update({ bytes: Number(limit) })
      .eq("id", big.id);
    try {
      const full = await reserve(viewer, await createEvent(calendar), 1);
      expect(full.error?.code).toBe("CF429");
      expect(full.error?.message).toBe("total");
    } finally {
      await admin.from("event_images").delete().eq("id", big.id);
      await admin
        .from("image_purge_queue")
        .delete()
        .eq("object_id", big.objectId);
    }
  });
});

describe("confirm_event_image (RF-2)", () => {
  it("needs both objects in Storage and only works on own pending rows", async () => {
    const event = await createEvent(calendar);
    const { data } = await reserve(viewer, event, 1);
    const id = data![0];

    const missing = await viewer.client.rpc("confirm_event_image", {
      p_id: id,
    });
    expect(missing.error?.code).toBe("P0002");
    const foreign = await owner.client.rpc("confirm_event_image", { p_id: id });
    expect(foreign.error?.code).toBe("CF404");
    const gone = await viewer.client.rpc("confirm_event_image", {
      p_id: randomUUID(),
    });
    expect(gone.error?.code).toBe("CF404");
  });
});
