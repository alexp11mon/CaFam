import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteQueuedImages,
  deleteTestMail,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 046, T1: the trash of 30 days per calendar (plan D1, D2, D3; RF-1,
// RF-4 to RF-7, RF-9, RF-10).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;
const objectIds: string[] = [];
const SECRET = process.env.CRON_SECRET ?? "";

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
  await deleteQueuedImages(objectIds);
  await deleteTestMail();
});

async function createEvent(title = "Cena") {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: calendar,
      title,
      created_by: owner.id,
      starts_at: "2026-11-02T10:00:00Z",
      ends_at: "2026-11-02T11:00:00Z",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Deletes an event the way the app does: snapshot first. */
async function trash(user: TestUser, title = "Cena") {
  const eventId = await createEvent(title);
  const { data, error } = await user.client.rpc("snapshot_event", {
    p_event_id: eventId,
  });
  if (error) throw error;
  await admin.from("events").delete().eq("id", eventId);
  return { eventId, trashId: data };
}

async function listed(user: TestUser) {
  const { data, error } = await user.client.rpc("trash_list");
  if (error) throw error;
  return data;
}

describe("trash_list (RF-3, RF-4, RF-10)", () => {
  it("shows owners and editors the copies of their calendars", async () => {
    const { trashId } = await trash(editor, "Dentista");
    for (const user of [owner, editor]) {
      const row = (await listed(user)).find((item) => item.id === trashId);
      expect(row).toMatchObject({
        calendar_id: calendar,
        kind: "event",
        title: "Dentista",
        all_day: false,
        deleted_by: editor.id,
        deleted_by_name: "Eva",
        images: 0,
        comments: 0,
      });
      const days = (Date.parse(row!.expires_at) - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
    }
  });

  it("shows nothing to readers, strangers and anon", async () => {
    const { trashId } = await trash(owner);
    for (const user of [viewer, stranger]) {
      expect((await listed(user)).map((item) => item.id)).not.toContain(
        trashId,
      );
    }
    const { data } = await anonClient().rpc("trash_list");
    expect(data ?? []).toEqual([]);
  });

  it("hides an expired copy and the trash of a calendar left (RF-10)", async () => {
    const { trashId } = await trash(owner);
    await admin
      .from("event_trash")
      .update({ expires_at: new Date(Date.now() - 3_600_000).toISOString() })
      .eq("id", trashId);
    expect((await listed(owner)).map((item) => item.id)).not.toContain(trashId);

    const other = await trash(owner);
    await admin
      .from("calendar_members")
      .update({ role: "viewer" })
      .eq("calendar_id", calendar)
      .eq("user_id", editor.id);
    try {
      expect((await listed(editor)).map((item) => item.id)).not.toContain(
        other.trashId,
      );
    } finally {
      await admin
        .from("calendar_members")
        .update({ role: "editor" })
        .eq("calendar_id", calendar)
        .eq("user_id", editor.id);
    }
  });

  it("an editor restores what another deleted, after the first minute (RF-5, RF-14)", async () => {
    const { eventId, trashId } = await trash(owner);
    await admin
      .from("event_trash")
      .update({
        created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      })
      .eq("id", trashId);
    const { data, error } = await editor.client.rpc("restore_event", {
      p_trash_id: trashId,
    });
    expect(error).toBeNull();
    expect(data).toBe(eventId);
  });

  it("keeps the copy when its author deletes the account", async () => {
    const leaving = await createTestUser({ display_name: "Leo" });
    try {
      await admin
        .from("calendar_members")
        .insert({ calendar_id: calendar, user_id: leaving.id, role: "editor" });
      const { trashId } = await trash(leaving);
      await deleteTestUser(leaving.id);
      const row = (await listed(owner)).find((item) => item.id === trashId);
      expect(row).toMatchObject({ deleted_by: null, deleted_by_name: null });
    } finally {
      await deleteTestUser(leaving.id).catch(() => {});
    }
  });
});

describe("trash_purge and trash_empty (RF-6, RF-7)", () => {
  it("an editor deletes one copy for ever; a reader cannot", async () => {
    const { trashId } = await trash(owner);
    const refused = await viewer.client.rpc("trash_purge", {
      p_trash_id: trashId,
    });
    expect(refused.error?.code).toBe("CF404");
    const { error } = await editor.client.rpc("trash_purge", {
      p_trash_id: trashId,
    });
    expect(error).toBeNull();
    expect((await listed(owner)).map((item) => item.id)).not.toContain(trashId);
  });

  it("only the owner empties the trash of a calendar", async () => {
    await trash(editor);
    const refused = await editor.client.rpc("trash_empty", {
      p_calendar_id: calendar,
    });
    expect(refused.error?.code).toBe("CF404");
    const { data, error } = await owner.client.rpc("trash_empty", {
      p_calendar_id: calendar,
    });
    expect(error).toBeNull();
    expect(data).toBeGreaterThan(0);
    expect(
      (await listed(owner)).filter((item) => item.calendar_id === calendar),
    ).toEqual([]);
  });

  it("the daily job removes only the copies past their 30 days", async () => {
    const fresh = await trash(owner);
    const old = await trash(owner);
    await admin
      .from("event_trash")
      .update({ expires_at: new Date(Date.now() - 3_600_000).toISOString() })
      .eq("id", old.trashId);
    const { error } = await admin.rpc("trash_purge");
    expect(error).toBeNull();
    const { data } = await admin
      .from("event_trash")
      .select("id")
      .in("id", [fresh.trashId, old.trashId]);
    expect(data).toEqual([{ id: fresh.trashId }]);
  });
});

describe("images in the trash (RF-9, plan D3)", () => {
  it("are never claimed while the copy lives, and are once it goes", async () => {
    const eventId = await createEvent();
    const objectId = randomUUID();
    objectIds.push(objectId);
    await admin.from("event_images").insert({
      event_id: eventId,
      object_id: objectId,
      uploaded_by: owner.id,
      status: "ready",
      bytes: 1000,
      width: 10,
      height: 10,
    });
    const { data: trashId } = await owner.client.rpc("snapshot_event", {
      p_event_id: eventId,
    });
    await admin.from("events").delete().eq("id", eventId);
    // Queued long ago, so only the trash keeps it.
    await admin
      .from("image_purge_queue")
      .update({ queued_at: "2000-01-01T00:00:00Z" })
      .eq("object_id", objectId);

    const claim = () =>
      anonClient().rpc("images_claim_purge", {
        p_secret: SECRET,
        p_object_ids: [objectId],
      });
    expect((await claim()).data).toEqual([]);

    await owner.client.rpc("trash_purge", { p_trash_id: trashId! });
    expect((await claim()).data).toEqual([objectId]);
  });
});
