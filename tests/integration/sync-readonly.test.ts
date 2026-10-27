import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 007, T2: synced calendars are read-only for everyone and cannot be
// merged (plan D11; RF-20, RF-44).
let owner: TestUser;
let editor: TestUser;
let syncedId: string;
let normalId: string;
let syncedEventId: string;
let normalEventId: string;

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

beforeAll(async () => {
  [owner, editor] = await Promise.all([
    createTestUser({ display_name: "Owner" }),
    createTestUser({ display_name: "Editor" }),
  ]);
  normalId = await getOwnCalendarId(owner.id);

  const { data: calendar, error } = await admin
    .from("calendars")
    .insert({ owner_id: owner.id, name: "Google" })
    .select("id")
    .single();
  if (error) throw error;
  syncedId = calendar.id;

  const { data: connection, error: connectionError } = await admin
    .from("calendar_connections")
    .insert({
      owner_id: owner.id,
      provider: "google",
      account_subject: "sub-readonly",
      account_email: "owner@gmail.test",
    })
    .select("id")
    .single();
  if (connectionError) throw connectionError;

  await admin.from("synced_calendars").insert({
    calendar_id: syncedId,
    connection_id: connection.id,
    provider: "google",
    external_id: "primary",
  });
  await admin.from("calendar_members").insert([
    { calendar_id: syncedId, user_id: editor.id, role: "editor" },
    { calendar_id: normalId, user_id: editor.id, role: "editor" },
  ]);

  const { data: events } = await admin
    .from("events")
    .insert([
      { calendar_id: syncedId, title: "Traído", ...TIMES, external_id: "e1" },
      { calendar_id: normalId, title: "Normal", ...TIMES },
    ])
    .select("id, calendar_id");
  syncedEventId = events!.find((e) => e.calendar_id === syncedId)!.id;
  normalEventId = events!.find((e) => e.calendar_id === normalId)!.id;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor].filter(Boolean).map((user) => deleteTestUser(user.id)),
  );
});

async function title(id: string) {
  const { data } = await admin
    .from("events")
    .select("title, calendar_id")
    .eq("id", id)
    .maybeSingle();
  return data;
}

describe.each([
  ["owner", () => owner],
  ["editor", () => editor],
])("synced calendar as %s (RF-20)", (_name, user) => {
  it("cannot insert an event", async () => {
    const { error } = await user()
      .client.from("events")
      .insert({ calendar_id: syncedId, title: "Nuevo", ...TIMES });
    expect(error?.code).toBe("42501");
  });

  it("cannot update or delete an event", async () => {
    await user()
      .client.from("events")
      .update({ title: "Cambiado" })
      .eq("id", syncedEventId);
    await user().client.from("events").delete().eq("id", syncedEventId);

    expect((await title(syncedEventId))?.title).toBe("Traído");
  });

  it("cannot move an event in or out", async () => {
    const into = await user()
      .client.from("events")
      .update({ calendar_id: syncedId })
      .eq("id", normalEventId);
    await user()
      .client.from("events")
      .update({ calendar_id: normalId })
      .eq("id", syncedEventId);

    expect(into.error?.code).toBe("42501");
    expect((await title(normalEventId))?.calendar_id).toBe(normalId);
    expect((await title(syncedEventId))?.calendar_id).toBe(syncedId);
  });

  it("still edits events of a normal calendar", async () => {
    const { error } = await user()
      .client.from("events")
      .update({ title: "Normal" })
      .eq("id", normalEventId);
    expect(error).toBeNull();
  });
});

describe("merging (RF-44)", () => {
  it("fails when a source is synced", async () => {
    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [normalId, syncedId],
      p_target_id: normalId,
    });
    expect(error).not.toBeNull();
    expect(await title(syncedEventId)).not.toBeNull();
  });

  it("fails when the target is synced", async () => {
    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [normalId, syncedId],
      p_target_id: syncedId,
    });
    expect(error).not.toBeNull();
    expect((await title(normalEventId))?.calendar_id).toBe(normalId);
  });
});
