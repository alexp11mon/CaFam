import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { applyChange } from "@/app/dashboard/offline-writes";
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

// Spec 035 T7: comments and deleted images made offline (RF-21, RF-22,
// RF-26 to RF-28, RF-38). RLS decides as with a connection.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The objects of a deleted image are purged after; nothing to purge here.
vi.mock("@/lib/images/purge", () => ({
  purgeDeps: () => ({ supabase: null, secret: "" }),
  purgeObjects: vi.fn(async () => undefined),
}));

const TZ = "Europe/Madrid";

let ana: TestUser;
let luis: TestUser;
let eva: TestUser;
let anaCal: string;

beforeAll(async () => {
  [ana, luis, eva] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
    createTestUser({ display_name: "Eva" }),
  ]);
  anaCal = await getOwnCalendarId(ana.id);
  const members = await admin.from("calendar_members").insert([
    { calendar_id: anaCal, user_id: luis.id, role: "viewer" },
    { calendar_id: anaCal, user_id: eva.id, role: "editor" },
  ]);
  if (members.error) throw members.error;
});

afterAll(async () => {
  for (const user of [ana, luis, eva]) if (user) await deleteTestUser(user.id);
  await deleteTestMail();
});

async function seedEvent(extra: object = {}) {
  const { data, error } = await admin
    .from("events")
    .insert({
      calendar_id: anaCal,
      title: "Cena",
      starts_at: "2026-11-20T19:00:00Z",
      ends_at: "2026-11-20T21:00:00Z",
      created_by: ana.id,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedComment(eventId: string, author: TestUser, body: string) {
  const { data, error } = await author.client
    .from("event_comments")
    .insert({ event_id: eventId, body, client_id: randomUUID() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function seedImage(eventId: string, uploader: TestUser) {
  const { data, error } = await admin
    .from("event_images")
    .insert({
      event_id: eventId,
      object_id: randomUUID(),
      uploaded_by: uploader.id,
      status: "ready",
      bytes: 1000,
      width: 100,
      height: 100,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const apply = (user: TestUser, change: unknown, force = false) =>
  applyChange(
    user.client,
    user.id,
    TZ,
    offlineChangeSchema.parse(change) as ParsedChange,
    force,
  );

const commentsOf = async (eventId: string) =>
  (
    await admin
      .from("event_comments")
      .select("id, body, author_id")
      .eq("event_id", eventId)
  ).data ?? [];

describe("comments (RF-21, RF-22, RF-26 to RF-28)", () => {
  it("adds once per client id, also a Reader", async () => {
    const eventId = await seedEvent();
    const change = {
      type: "comment.add",
      eventId,
      clientId: randomUUID(),
      body: "Llevo el postre",
    };
    expect(await apply(luis, change)).toEqual({ status: "applied" });
    expect(await apply(luis, change)).toEqual({ status: "applied" });
    expect(await commentsOf(eventId)).toEqual([
      expect.objectContaining({ body: "Llevo el postre", author_id: luis.id }),
    ]);
  });

  it("adds on an occurrence without its own row", async () => {
    const seriesId = await seedEvent({
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;COUNT=3",
      recurrence_tz: TZ,
      recurrence_until: "2026-12-04T21:00:00Z",
    });
    const result = await apply(ana, {
      type: "comment.add",
      eventId: occurrenceId(seriesId, "2026-11-27T19:00:00.000Z"),
      clientId: randomUUID(),
      body: "Esta semana no",
    });
    expect(result).toEqual({ status: "applied" });
    const { data } = await admin
      .from("events")
      .select("id")
      .eq("series_id", seriesId);
    expect(data).toHaveLength(1);
  });

  it("edits when nobody changed it, and asks when someone did", async () => {
    const eventId = await seedEvent();
    const id = await seedComment(eventId, ana, "Llego tarde");
    expect(
      await apply(ana, {
        type: "comment.update",
        id,
        eventId,
        base: { body: "Llego tarde" },
        body: "Llego a las 21:30",
      }),
    ).toEqual({ status: "applied" });

    await admin
      .from("event_comments")
      .update({ body: "Cambiado en otro móvil" })
      .eq("id", id);
    expect(
      await apply(ana, {
        type: "comment.update",
        id,
        eventId,
        base: { body: "Llego a las 21:30" },
        body: "Llego a las 22:00",
      }),
    ).toEqual({
      status: "conflict",
      server: { body: "Cambiado en otro móvil" },
    });
  });

  it("editing a deleted comment is rejected; deleting it is done", async () => {
    const eventId = await seedEvent();
    const id = await seedComment(eventId, ana, "Hola");
    await admin.from("event_comments").delete().eq("id", id);
    expect(
      await apply(ana, {
        type: "comment.update",
        id,
        eventId,
        base: { body: "Hola" },
        body: "Adiós",
      }),
    ).toEqual({ status: "rejected", reason: expect.any(String) });
    expect(
      await apply(ana, {
        type: "comment.delete",
        id,
        eventId,
        base: { body: "Hola" },
      }),
    ).toEqual({ status: "applied" });
  });

  it("someone else's comment cannot be edited", async () => {
    const eventId = await seedEvent();
    const id = await seedComment(eventId, ana, "Mío");
    expect(
      await apply(luis, {
        type: "comment.update",
        id,
        eventId,
        base: { body: "Mío" },
        body: "Tuyo",
      }),
    ).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/permiso/i),
    });
  });

  it("a deleted event, or being expelled, is rejected", async () => {
    const gone = await seedEvent();
    await admin.from("events").delete().eq("id", gone);
    expect(
      await apply(ana, {
        type: "comment.add",
        eventId: gone,
        clientId: randomUUID(),
        body: "¿Sigue en pie?",
      }),
    ).toEqual({ status: "rejected", reason: expect.any(String) });

    const eventId = await seedEvent();
    const id = await seedComment(eventId, eva, "Voy");
    await admin
      .from("calendar_members")
      .delete()
      .eq("calendar_id", anaCal)
      .eq("user_id", eva.id);
    expect(
      await apply(eva, {
        type: "comment.delete",
        id,
        eventId,
        base: { body: "Voy" },
      }),
    ).toEqual({ status: "rejected", reason: expect.any(String) });
    const back = await admin
      .from("calendar_members")
      .insert({ calendar_id: anaCal, user_id: eva.id, role: "editor" });
    if (back.error) throw back.error;
  });
});

describe("deleting images (RF-38)", () => {
  it("own image, as owner and as Editor: done; already deleted: done", async () => {
    const eventId = await seedEvent();
    const own = await seedImage(eventId, luis);
    const forOwner = await seedImage(eventId, luis);
    const forEditor = await seedImage(eventId, luis);
    for (const [user, id] of [
      [luis, own],
      [ana, forOwner],
      [eva, forEditor],
    ] as const) {
      expect(await apply(user, { type: "image.delete", id, eventId })).toEqual({
        status: "applied",
      });
    }
    expect(
      await apply(ana, { type: "image.delete", id: own, eventId }),
    ).toEqual({ status: "applied" });
    const { count } = await admin
      .from("event_images")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    expect(count).toBe(0);
  });

  it("a Reader cannot delete someone else's image", async () => {
    const eventId = await seedEvent();
    const id = await seedImage(eventId, ana);
    expect(await apply(luis, { type: "image.delete", id, eventId })).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/permiso/i),
    });
  });
});
