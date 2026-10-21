import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers";

// Spec 002, T2: merge_calendars (plan "Funciones y triggers";
// RF-49, 50, 51, 53, 54, 55).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;

const TIMES = {
  starts_at: "2026-11-02T10:00:00Z",
  ends_at: "2026-11-02T11:00:00Z",
};

async function createCalendar(name: string, color = "#FFD6A5") {
  const { data, error } = await owner.client
    .from("calendars")
    .insert({ owner_id: owner.id, name, color, description: `Desc ${name}` })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function createCategory(calendarId: string, name: string) {
  const { data, error } = await owner.client
    .from("event_categories")
    .insert({ calendar_id: calendarId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function createEvent(
  calendarId: string,
  title: string,
  categoryId: string | null = null,
) {
  const { data, error } = await owner.client
    .from("events")
    .insert({
      calendar_id: calendarId,
      title,
      category_id: categoryId,
      ...TIMES,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function calendarExists(id: string) {
  const { data } = await admin.from("calendars").select("id").eq("id", id);
  return (data ?? []).length === 1;
}

async function eventsOf(calendarId: string) {
  const { data } = await admin
    .from("events")
    .select("title, category_id")
    .eq("calendar_id", calendarId)
    .order("title");
  return data ?? [];
}

async function categoriesOf(calendarId: string) {
  const { data } = await admin
    .from("event_categories")
    .select("id, name")
    .eq("calendar_id", calendarId)
    .order("name");
  return data ?? [];
}

beforeAll(async () => {
  [owner, editor, viewer, stranger] = await Promise.all([
    createTestUser({ display_name: "Propietaria" }),
    createTestUser({ display_name: "Editora" }),
    createTestUser({ display_name: "Lectora" }),
    createTestUser({ display_name: "Otra" }),
  ]);
});

afterAll(async () => {
  await Promise.all(
    [owner, editor, viewer, stranger]
      .filter(Boolean)
      .map((user) => deleteTestUser(user.id)),
  );
});

describe("merge_calendars into an existing calendar (RF-49, RF-50)", () => {
  it("moves events and categories to the target and removes the others", async () => {
    const classes = await createCalendar("Clases Uni", "#FFD6A5");
    const exams = await createCalendar("Examenes Uni", "#CAFFBF");
    const examsCategory = await createCategory(exams, "Parciales");
    await createEvent(classes, "Matemáticas");
    await createEvent(exams, "Parcial de álgebra", examsCategory);

    const { data, error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [classes, exams],
      p_target_id: classes,
    });

    expect(error).toBeNull();
    expect(data).toBe(classes);
    expect(await calendarExists(exams)).toBe(false);
    expect(await eventsOf(classes)).toEqual([
      { title: "Matemáticas", category_id: null },
      { title: "Parcial de álgebra", category_id: examsCategory },
    ]);
    expect(await categoriesOf(classes)).toEqual([
      { id: examsCategory, name: "Parciales" },
    ]);

    const { data: kept } = await admin
      .from("calendars")
      .select("name, color, description")
      .eq("id", classes)
      .single();
    expect(kept).toEqual({
      name: "Clases Uni",
      color: "#FFD6A5",
      description: "Desc Clases Uni",
    });
  });

  it("merges three calendars at once", async () => {
    const a = await createCalendar("A");
    const b = await createCalendar("B");
    const c = await createCalendar("C");
    await createEvent(a, "ea");
    await createEvent(b, "eb");
    await createEvent(c, "ec");

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [a, b, c],
      p_target_id: b,
    });

    expect(error).toBeNull();
    expect((await eventsOf(b)).map((e) => e.title)).toEqual(["ea", "eb", "ec"]);
    expect(await calendarExists(a)).toBe(false);
    expect(await calendarExists(c)).toBe(false);
  });
});

describe("merge_calendars into a new calendar (RF-50)", () => {
  it("creates the result with the given name and color and removes every source", async () => {
    const classes = await createCalendar("Clases Uni 2");
    const exams = await createCalendar("Examenes Uni 2");
    await createEvent(classes, "Física");
    await createEvent(exams, "Final de física");

    const { data, error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [classes, exams],
      p_name: "Universidad",
      p_color: "#A0C4FF",
    });

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const merged = data as string;
    expect([classes, exams]).not.toContain(merged);
    expect(await calendarExists(classes)).toBe(false);
    expect(await calendarExists(exams)).toBe(false);
    expect((await eventsOf(merged)).map((e) => e.title)).toEqual([
      "Final de física",
      "Física",
    ]);

    const { data: calendar } = await admin
      .from("calendars")
      .select("owner_id, name, color")
      .eq("id", merged)
      .single();
    expect(calendar).toEqual({
      owner_id: owner.id,
      name: "Universidad",
      color: "#A0C4FF",
    });

    const { data: members } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", merged);
    expect(members).toEqual([{ user_id: owner.id, role: "owner" }]);
  });
});

describe("categories on merge (RF-51)", () => {
  it("unifies categories with the same normalized name, also among sources", async () => {
    const target = await createCalendar("Destino");
    const first = await createCalendar("Origen 1");
    const second = await createCalendar("Origen 2");
    const targetCategory = await createCategory(target, "Clases");
    const firstSame = await createCategory(first, "  CLASES ");
    const firstOnly = await createCategory(first, "Examen");
    const secondOnly = await createCategory(second, "examen");
    await createEvent(target, "t1", targetCategory);
    await createEvent(first, "f1", firstSame);
    await createEvent(first, "f2", firstOnly);
    await createEvent(second, "s1", secondOnly);

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [target, first, second],
      p_target_id: target,
    });

    expect(error).toBeNull();
    const categories = await categoriesOf(target);
    expect(categories.map((c) => c.name.trim().toLowerCase()).sort()).toEqual([
      "clases",
      "examen",
    ]);
    const clases = categories.find(
      (c) => c.name.trim().toLowerCase() === "clases",
    )!;
    const examen = categories.find(
      (c) => c.name.trim().toLowerCase() === "examen",
    )!;
    expect(await eventsOf(target)).toEqual([
      { title: "f1", category_id: clases.id },
      { title: "f2", category_id: examen.id },
      { title: "s1", category_id: examen.id },
      { title: "t1", category_id: clases.id },
    ]);
  });
});

describe("permissions and validation (RF-53)", () => {
  it("rejects fewer than two distinct calendars", async () => {
    const only = await createCalendar("Solo uno");

    const one = await owner.client.rpc("merge_calendars", {
      p_source_ids: [only],
      p_target_id: only,
    });
    const repeated = await owner.client.rpc("merge_calendars", {
      p_source_ids: [only, only],
      p_target_id: only,
    });

    expect(one.error?.code).toBe("22023");
    expect(repeated.error?.code).toBe("22023");
    expect(await calendarExists(only)).toBe(true);
  });

  it("rejects a target that is not among the sources", async () => {
    const a = await createCalendar("T-a");
    const b = await createCalendar("T-b");
    const c = await createCalendar("T-c");

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [a, b],
      p_target_id: c,
    });

    expect(error?.code).toBe("22023");
    expect(await calendarExists(a)).toBe(true);
    expect(await calendarExists(b)).toBe(true);
  });

  it("rejects a new calendar without a name", async () => {
    const a = await createCalendar("N-a");
    const b = await createCalendar("N-b");

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [a, b],
    });

    expect(error?.code).toBe("22023");
  });

  it("rejects merging calendars the user does not own, without changes", async () => {
    const mine = await createCalendar("Mío");
    const sharedId = (
      await admin
        .from("calendars")
        .select("id")
        .eq("owner_id", stranger.id)
        .single()
    ).data!.id;
    await admin
      .from("calendar_members")
      .insert([{ calendar_id: sharedId, user_id: owner.id, role: "editor" }]);
    await createEvent(mine, "mío");

    const asEditor = await owner.client.rpc("merge_calendars", {
      p_source_ids: [mine, sharedId],
      p_target_id: mine,
    });
    const asStranger = await stranger.client.rpc("merge_calendars", {
      p_source_ids: [mine, sharedId],
      p_target_id: sharedId,
    });

    expect(asEditor.error?.code).toBe("42501");
    expect(asStranger.error?.code).toBe("42501");
    expect(await calendarExists(mine)).toBe(true);
    expect(await calendarExists(sharedId)).toBe(true);
    expect((await eventsOf(mine)).map((e) => e.title)).toEqual(["mío"]);
  });

  it("rejects calendars that do not exist", async () => {
    const mine = await createCalendar("Real");

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [mine, "00000000-0000-0000-0000-000000000000"],
      p_target_id: mine,
    });

    expect(error?.code).toBe("42501");
    expect(await calendarExists(mine)).toBe(true);
  });

  it("is not callable by anon", async () => {
    const { error } = await anonClient().rpc("merge_calendars", {
      p_source_ids: [],
    });

    expect(error).not.toBeNull();
  });
});

describe("all or nothing (RF-54)", () => {
  it("leaves every calendar, event and category intact when the new calendar is invalid", async () => {
    const a = await createCalendar("Atómico A");
    const b = await createCalendar("Atómico B");
    const category = await createCategory(b, "Cat");
    await createEvent(a, "ea");
    await createEvent(b, "eb", category);

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [a, b],
      p_name: "n".repeat(51),
      p_color: "#A0C4FF",
    });

    expect(error?.code).toBe("23514");
    expect(await calendarExists(a)).toBe(true);
    expect(await calendarExists(b)).toBe(true);
    expect(await eventsOf(a)).toEqual([{ title: "ea", category_id: null }]);
    expect(await eventsOf(b)).toEqual([{ title: "eb", category_id: category }]);
    expect(await categoriesOf(b)).toEqual([{ id: category, name: "Cat" }]);
  });
});

describe("members (RF-55)", () => {
  it("keeps the target's members and drops the sources' members", async () => {
    const target = await createCalendar("Con miembros");
    const source = await createCalendar("Origen con miembros");
    await admin.from("calendar_members").insert([
      { calendar_id: target, user_id: editor.id, role: "editor" },
      { calendar_id: source, user_id: viewer.id, role: "viewer" },
    ]);

    const { error } = await owner.client.rpc("merge_calendars", {
      p_source_ids: [target, source],
      p_target_id: target,
    });
    const { data: members } = await admin
      .from("calendar_members")
      .select("user_id, role")
      .eq("calendar_id", target);

    expect(error).toBeNull();
    expect((members ?? []).map((m) => m.user_id).sort()).toEqual(
      [owner.id, editor.id].sort(),
    );
    const { data: viewerRows } = await admin
      .from("calendar_members")
      .select("calendar_id")
      .eq("user_id", viewer.id);
    expect((viewerRows ?? []).map((row) => row.calendar_id)).not.toContain(
      source,
    );
  });
});
