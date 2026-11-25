import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 051, T1: the author of an event is the server's to set (RF-1 to RF-3).
let owner: TestUser;
let editor: TestUser;
let calendarId: string;

beforeAll(async () => {
  [owner, editor] = await Promise.all([
    createTestUser({ display_name: "Ana" }),
    createTestUser({ display_name: "Luis" }),
  ]);
  const { data, error } = await owner.client
    .from("calendars")
    .insert({ name: "Familia", owner_id: owner.id })
    .select("id")
    .single();
  if (error) throw error;
  calendarId = data.id;
  const { error: memberError } = await admin
    .from("calendar_members")
    .insert({ calendar_id: calendarId, user_id: editor.id, role: "editor" });
  if (memberError) throw memberError;
});

afterAll(async () => {
  await deleteTestUser(owner.id);
  await deleteTestUser(editor.id);
});

const slot = {
  title: "Cena",
  starts_at: "2026-12-01T18:00:00Z",
  ends_at: "2026-12-01T19:00:00Z",
};

async function authorOf(id: string): Promise<string | null> {
  const { data, error } = await admin
    .from("events")
    .select("created_by")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data.created_by;
}

describe("events.created_by", () => {
  it("is whoever creates it, whatever the client sends (RF-1)", async () => {
    const { data, error } = await editor.client
      .from("events")
      .insert({ ...slot, calendar_id: calendarId, created_by: owner.id })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect(await authorOf(data!.id)).toBe(editor.id);
  });

  it("cannot be changed with an update (RF-2)", async () => {
    const { data } = await owner.client
      .from("events")
      .insert({ ...slot, calendar_id: calendarId, created_by: owner.id })
      .select("id")
      .single();
    const { error } = await editor.client
      .from("events")
      .update({ created_by: editor.id, title: "Cena 2" })
      .eq("id", data!.id);
    expect(error).toBeNull();
    expect(await authorOf(data!.id)).toBe(owner.id);
  });

  it("a series made from another's event keeps its author (RF-3)", async () => {
    const { data: original } = await owner.client
      .from("events")
      .insert({ ...slot, calendar_id: calendarId, created_by: owner.id })
      .select("id")
      .single();
    const { data: series } = await editor.client
      .from("events")
      .insert({
        ...slot,
        calendar_id: calendarId,
        created_by: owner.id,
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU",
        recurrence_tz: "Europe/Madrid",
      })
      .select("id")
      .single();
    expect(await authorOf(series!.id)).toBe(editor.id);
    await editor.client
      .from("events")
      .update({ series_id: series!.id, original_start: slot.starts_at })
      .eq("id", original!.id);
    const { error } = await editor.client.rpc("convert_keep_author", {
      p_event_id: original!.id,
    });
    expect(error).toBeNull();
    expect(await authorOf(series!.id)).toBe(owner.id);
    expect(await authorOf(original!.id)).toBe(owner.id);
  });

  it("convert_keep_author refuses an event that is not a first occurrence", async () => {
    const { data } = await editor.client
      .from("events")
      .insert({ ...slot, calendar_id: calendarId })
      .select("id")
      .single();
    const { error } = await editor.client.rpc("convert_keep_author", {
      p_event_id: data!.id,
    });
    expect(error?.code).toBe("CF404");
  });

  it("server functions keep their authors: restore (RF-3)", async () => {
    const { data } = await owner.client
      .from("events")
      .insert({ ...slot, calendar_id: calendarId })
      .select("id")
      .single();
    const { data: snapshot, error: snapError } = await editor.client.rpc(
      "snapshot_event",
      { p_event_id: data!.id },
    );
    expect(snapError).toBeNull();
    await editor.client.from("events").delete().eq("id", data!.id);
    const { error } = await editor.client.rpc("restore_event", {
      p_trash_id: snapshot!,
    });
    expect(error).toBeNull();
    expect(await authorOf(data!.id)).toBe(owner.id);
  });
});
