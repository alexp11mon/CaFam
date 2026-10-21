import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  getOwnCalendarId,
  type TestUser,
} from "./helpers";

// Spec 002, T1: categories, preferences, event columns, limits and visible_people
// (plan "Modelo de datos"; RF-4, 8, 10-14, 16, 19, 25, 27, 28, 42, 46, 48).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let ownerCalendarId: string; // editor and viewer are members
let editorCalendarId: string; // owned by editor
let outsiderCalendarId: string; // owner is only a viewer there

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

async function createCategory(
  user: TestUser,
  calendarId: string,
  name: string,
) {
  return user.client
    .from("event_categories")
    .insert({ calendar_id: calendarId, name })
    .select("id")
    .single();
}

async function createEvent(
  calendarId: string,
  extra: { category_id?: string | null } = {},
) {
  const { data, error } = await owner.client
    .from("events")
    .insert({ calendar_id: calendarId, title: "Clase", ...TIMES, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [owner, editor, viewer, outsider] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Ajena" }),
  ]);
  [ownerCalendarId, editorCalendarId, outsiderCalendarId] = await Promise.all([
    getOwnCalendarId(owner.id),
    getOwnCalendarId(editor.id),
    getOwnCalendarId(outsider.id),
  ]);

  const { error } = await admin.from("calendar_members").insert([
    { calendar_id: ownerCalendarId, user_id: editor.id, role: "editor" },
    { calendar_id: ownerCalendarId, user_id: viewer.id, role: "viewer" },
    { calendar_id: outsiderCalendarId, user_id: owner.id, role: "viewer" },
  ]);
  if (error) throw error;
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, outsider]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("event_categories", () => {
  it("lets the owner and editors create categories, members read them (RF-9, RF-13)", async () => {
    const byOwner = await createCategory(owner, ownerCalendarId, "Clases UNI");
    const byEditor = await createCategory(editor, ownerCalendarId, "Familia");

    expect(byOwner.error).toBeNull();
    expect(byEditor.error).toBeNull();

    const seenByViewer = await viewer.client
      .from("event_categories")
      .select("name")
      .eq("calendar_id", ownerCalendarId);
    expect(seenByViewer.data?.map((c) => c.name).sort()).toEqual([
      "Clases UNI",
      "Familia",
    ]);
  });

  it("hides categories from non-members (RF-13)", async () => {
    const { data } = await outsider.client
      .from("event_categories")
      .select("id")
      .eq("calendar_id", ownerCalendarId);

    expect(data).toEqual([]);
  });

  it("rejects creating, renaming and deleting for viewers (RF-14)", async () => {
    const created = await createCategory(viewer, ownerCalendarId, "Intrusa");
    expect(created.error?.code).toBe("42501");

    const { data: existing } = await admin
      .from("event_categories")
      .select("id")
      .eq("calendar_id", ownerCalendarId)
      .eq("name", "Familia")
      .single();

    const renamed = await viewer.client
      .from("event_categories")
      .update({ name: "Cambiada" })
      .eq("id", existing!.id)
      .select("id");
    const deleted = await viewer.client
      .from("event_categories")
      .delete()
      .eq("id", existing!.id)
      .select("id");

    expect(renamed.data).toEqual([]);
    expect(deleted.data).toEqual([]);
  });

  it("rejects non-members creating categories", async () => {
    const { error } = await createCategory(outsider, ownerCalendarId, "Otra");

    expect(error?.code).toBe("42501");
  });

  it("rejects duplicates ignoring case and outer spaces (RF-10)", async () => {
    const { error } = await createCategory(
      owner,
      ownerCalendarId,
      "  clases uni ",
    );

    expect(error?.code).toBe("23505");
  });

  it("allows the same name in a different calendar", async () => {
    const { error } = await createCategory(
      editor,
      editorCalendarId,
      "Clases UNI",
    );

    expect(error).toBeNull();
  });

  it("rejects empty and 41-character names", async () => {
    const empty = await createCategory(owner, ownerCalendarId, "   ");
    const long = await createCategory(owner, ownerCalendarId, "x".repeat(41));
    const max = await createCategory(owner, ownerCalendarId, "y".repeat(40));

    expect(empty.error?.code).toBe("23514");
    expect(long.error?.code).toBe("23514");
    expect(max.error).toBeNull();
  });

  it("lets an editor rename a category and events keep using it (RF-11)", async () => {
    const category = await createCategory(owner, ownerCalendarId, "Examenes");
    const eventId = await createEvent(ownerCalendarId, {
      category_id: category.data!.id,
    });

    const renamed = await editor.client
      .from("event_categories")
      .update({ name: "Exámenes UNI" })
      .eq("id", category.data!.id)
      .select("name")
      .single();
    const { data: event } = await admin
      .from("events")
      .select("category_id")
      .eq("id", eventId)
      .single();

    expect(renamed.data?.name).toBe("Exámenes UNI");
    expect(event?.category_id).toBe(category.data!.id);
  });

  it("keeps events without a category when a category is deleted (RF-11, RF-12)", async () => {
    const category = await createCategory(owner, ownerCalendarId, "Temporal");
    const eventId = await createEvent(ownerCalendarId, {
      category_id: category.data!.id,
    });

    const deleted = await editor.client
      .from("event_categories")
      .delete()
      .eq("id", category.data!.id)
      .select("id");
    const { data: event } = await admin
      .from("events")
      .select("id, category_id")
      .eq("id", eventId)
      .single();

    expect(deleted.data).toHaveLength(1);
    expect(event).toEqual({ id: eventId, category_id: null });
  });
});

describe("events: color, category and calendar changes", () => {
  it("stores an optional color and rejects invalid ones (RF-16)", async () => {
    const valid = await owner.client
      .from("events")
      .insert({
        calendar_id: ownerCalendarId,
        title: "Con color",
        color: "#A5D8FF",
        ...TIMES,
      })
      .select("color")
      .single();
    const invalid = await owner.client.from("events").insert({
      calendar_id: ownerCalendarId,
      title: "Mal color",
      color: "azul",
      ...TIMES,
    });

    expect(valid.data?.color).toBe("#A5D8FF");
    expect(invalid.error?.code).toBe("23514");
  });

  it("rejects a category from another calendar (RF-28)", async () => {
    const foreign = await createCategory(
      editor,
      editorCalendarId,
      "Ajena al otro",
    );

    const { error } = await owner.client.from("events").insert({
      calendar_id: ownerCalendarId,
      title: "Mezcla",
      category_id: foreign.data!.id,
      ...TIMES,
    });

    expect(error?.code).toBe("23503");
  });

  it("rejects assigning a category of another calendar on update (RF-28)", async () => {
    const foreign = await createCategory(
      editor,
      editorCalendarId,
      "Ajena al otro 2",
    );
    const eventId = await createEvent(ownerCalendarId);

    const { error } = await owner.client
      .from("events")
      .update({ category_id: foreign.data!.id })
      .eq("id", eventId);

    expect(error?.code).toBe("23503");
  });

  it("moves an event between calendars where the user can write and drops its category (RF-27)", async () => {
    const category = await createCategory(owner, ownerCalendarId, "Se pierde");
    const eventId = await createEvent(ownerCalendarId, {
      category_id: category.data!.id,
    });
    // The editor can write in both calendars: member of one, owner of the other.
    const moved = await editor.client
      .from("events")
      .update({ calendar_id: editorCalendarId })
      .eq("id", eventId)
      .select("calendar_id, category_id")
      .single();

    expect(moved.error).toBeNull();
    expect(moved.data).toEqual({
      calendar_id: editorCalendarId,
      category_id: null,
    });
  });

  it("rejects moving an event to a calendar where the user is only a viewer (RF-27)", async () => {
    const eventId = await createEvent(ownerCalendarId);

    const { error } = await owner.client
      .from("events")
      .update({ calendar_id: outsiderCalendarId })
      .eq("id", eventId);

    expect(error?.code).toBe("42501");
  });

  it("rejects viewers creating events (RF-25)", async () => {
    const { error } = await viewer.client
      .from("events")
      .insert({ calendar_id: ownerCalendarId, title: "Lectora", ...TIMES });

    expect(error?.code).toBe("42501");
  });
});

describe("length limits (RF-4, RF-16, RF-19)", () => {
  it("limits the event title to 100 characters", async () => {
    const ok = await owner.client.from("events").insert({
      calendar_id: ownerCalendarId,
      title: "t".repeat(100),
      ...TIMES,
    });
    const long = await owner.client.from("events").insert({
      calendar_id: ownerCalendarId,
      title: "t".repeat(101),
      ...TIMES,
    });

    expect(ok.error).toBeNull();
    expect(long.error?.code).toBe("23514");
  });

  it("limits the event description to 2000 and the location to 200", async () => {
    const base = { calendar_id: ownerCalendarId, title: "Límites", ...TIMES };
    const ok = await owner.client.from("events").insert({
      ...base,
      description: "d".repeat(2000),
      location: "l".repeat(200),
    });
    const longDescription = await owner.client
      .from("events")
      .insert({ ...base, description: "d".repeat(2001) });
    const longLocation = await owner.client
      .from("events")
      .insert({ ...base, location: "l".repeat(201) });

    expect(ok.error).toBeNull();
    expect(longDescription.error?.code).toBe("23514");
    expect(longLocation.error?.code).toBe("23514");
  });

  it("limits the calendar name to 50 characters", async () => {
    const ok = await owner.client
      .from("calendars")
      .insert({ owner_id: owner.id, name: "c".repeat(50) });
    const long = await owner.client
      .from("calendars")
      .insert({ owner_id: owner.id, name: "c".repeat(51) });

    expect(ok.error).toBeNull();
    expect(long.error?.code).toBe("23514");
  });
});

describe("calendar_preferences and person_preferences (RF-46, RF-48)", () => {
  it("lets a user save and read their own calendar preferences", async () => {
    const { error } = await viewer.client.from("calendar_preferences").upsert({
      user_id: viewer.id,
      calendar_id: ownerCalendarId,
      visible: false,
      position: 2,
    });
    const { data } = await viewer.client
      .from("calendar_preferences")
      .select("calendar_id, visible, position")
      .eq("user_id", viewer.id);

    expect(error).toBeNull();
    expect(data).toEqual([
      { calendar_id: ownerCalendarId, visible: false, position: 2 },
    ]);
  });

  it("keeps preferences private from other users", async () => {
    const { data } = await owner.client
      .from("calendar_preferences")
      .select("user_id")
      .eq("user_id", viewer.id);

    expect(data).toEqual([]);
  });

  it("rejects preferences for someone else or for a calendar the user cannot see", async () => {
    const forOther = await owner.client.from("calendar_preferences").insert({
      user_id: viewer.id,
      calendar_id: ownerCalendarId,
      visible: true,
    });
    const notMember = await outsider.client
      .from("calendar_preferences")
      .insert({
        user_id: outsider.id,
        calendar_id: ownerCalendarId,
        visible: true,
      });

    expect(forOther.error?.code).toBe("42501");
    expect(notMember.error?.code).toBe("42501");
  });

  it("lets a user save the order of people, privately", async () => {
    const saved = await viewer.client.from("person_preferences").upsert({
      user_id: viewer.id,
      person_id: owner.id,
      position: 0,
    });
    const own = await viewer.client
      .from("person_preferences")
      .select("person_id, position")
      .eq("user_id", viewer.id);
    const others = await owner.client
      .from("person_preferences")
      .select("user_id")
      .eq("user_id", viewer.id);
    const forOther = await owner.client.from("person_preferences").insert({
      user_id: viewer.id,
      person_id: owner.id,
      position: 1,
    });

    expect(saved.error).toBeNull();
    expect(own.data).toEqual([{ person_id: owner.id, position: 0 }]);
    expect(others.data).toEqual([]);
    expect(forOther.error?.code).toBe("42501");
  });

  it("gives anon no access", async () => {
    const anon = anonClient();
    const [calendars, people] = await Promise.all([
      anon.from("calendar_preferences").select("user_id"),
      anon.from("person_preferences").select("user_id"),
    ]);

    expect(calendars.data).toEqual([]);
    expect(people.data).toEqual([]);
  });

  it("removes preferences when the calendar is deleted", async () => {
    const calendar = await owner.client
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Efímero" })
      .select("id")
      .single();
    await owner.client.from("calendar_preferences").insert({
      user_id: owner.id,
      calendar_id: calendar.data!.id,
      visible: true,
    });

    await owner.client.from("calendars").delete().eq("id", calendar.data!.id);
    const { data } = await admin
      .from("calendar_preferences")
      .select("calendar_id")
      .eq("calendar_id", calendar.data!.id);

    expect(data).toEqual([]);
  });
});

describe("visible_people (RF-42)", () => {
  it("returns only the user and the owners of calendars they belong to", async () => {
    const [forViewer, forOwner, forOutsider] = await Promise.all([
      viewer.client.rpc("visible_people"),
      owner.client.rpc("visible_people"),
      outsider.client.rpc("visible_people"),
    ]);
    const ids = (rows: { id: string }[] | null) =>
      (rows ?? []).map((r) => r.id).sort();

    expect(ids(forViewer.data)).toEqual([owner.id, viewer.id].sort());
    // owner is a viewer of the outsider's calendar, so the outsider shows up too.
    expect(ids(forOwner.data)).toEqual([outsider.id, owner.id].sort());
    expect(ids(forOutsider.data)).toEqual([outsider.id]);
  });

  it("exposes only id and display_name", async () => {
    const { data } = await viewer.client.rpc("visible_people");

    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(["display_name", "id"]);
    }
    expect(data?.find((row) => row.id === owner.id)?.display_name).toBe(
      "Propietaria",
    );
  });

  it("is not callable by anon", async () => {
    const { error } = await anonClient().rpc("visible_people");

    expect(error).not.toBeNull();
  });
});
