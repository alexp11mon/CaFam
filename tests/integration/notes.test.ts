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

// Spec 028, T1: notes, their items and who may read and write them (plan
// "Modelo de datos", D1 to D4, D10; RF-13, RF-14).
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let stranger: TestUser;
let calendar: string;
const extraUsers: string[] = [];

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
    [owner, editor, viewer, stranger, ...extraUsers.map((id) => ({ id }))].map(
      (user) => deleteTestUser(user.id).catch(() => {}),
    ),
  );
  await deleteTestMail();
});

async function note(
  user: TestUser,
  fields: { calendar_id?: string; kind?: "list" | "text"; title?: string } = {},
) {
  const id = randomUUID();
  const { error } = await user.client
    .from("notes")
    .insert({ id, title: "Compra", ...fields });
  if (error) throw error;
  return id;
}

const seen = async (user: TestUser, id: string) =>
  (await user.client.from("notes").select("id").eq("id", id)).data?.length ?? 0;

describe("a personal note", () => {
  it("is its author's by default, and only theirs to see and change", async () => {
    const id = await note(owner);
    const { data } = await admin
      .from("notes")
      .select("owner_id, calendar_id, kind, pinned, archived")
      .eq("id", id)
      .single();
    expect(data).toEqual({
      owner_id: owner.id,
      calendar_id: null,
      kind: "list",
      pinned: false,
      archived: false,
    });

    expect(await seen(owner, id)).toBe(1);
    // Not even the members of the author's calendars.
    expect(await seen(editor, id)).toBe(0);
    expect(await seen(stranger, id)).toBe(0);
    expect((await anonClient().from("notes").select("id")).data ?? []).toEqual(
      [],
    );

    const changed = await stranger.client
      .from("notes")
      .update({ title: "Mía" })
      .eq("id", id)
      .select("id");
    expect(changed.data).toEqual([]);
    const removed = await stranger.client
      .from("notes")
      .delete()
      .eq("id", id)
      .select("id");
    expect(removed.data).toEqual([]);
    const item = await stranger.client
      .from("note_items")
      .insert({ note_id: id, text: "Colarme" });
    expect(item.error?.code).toBe("42501");
  });

  it("cannot be created in someone else's name nor given another author", async () => {
    const forged = await stranger.client
      .from("notes")
      // The column is not writable by clients at all.
      .insert({ title: "Falsa", owner_id: owner.id } as never);
    expect(forged.error?.code).toBe("42501");

    const id = await note(owner);
    const stolen = await owner.client
      .from("notes")
      .update({ owner_id: stranger.id } as never)
      .eq("id", id);
    expect(stolen.error?.code).toBe("42501");
  });

  it("trims its title, keeps its kind and moves up when it changes", async () => {
    const id = await note(owner, { title: "  Deberes  " });
    const before = await admin
      .from("notes")
      .select("title, updated_at")
      .eq("id", id)
      .single();
    expect(before.data?.title).toBe("Deberes");

    const kind = await owner.client
      .from("notes")
      .update({ kind: "text" } as never)
      .eq("id", id);
    expect(kind.error).not.toBeNull();

    const { error } = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "  Mates  " });
    expect(error).toBeNull();
    const after = await admin
      .from("notes")
      .select("updated_at, note_items(text)")
      .eq("id", id)
      .single();
    expect(after.data?.note_items).toEqual([{ text: "Mates" }]);
    expect(Date.parse(after.data!.updated_at)).toBeGreaterThan(
      Date.parse(before.data!.updated_at),
    );
  });
});

describe("items", () => {
  it("come back in their order and remember when they were done", async () => {
    const id = await note(owner);
    const { error } = await owner.client.from("note_items").insert([
      { note_id: id, text: "Tercero", position: 2 },
      { note_id: id, text: "Primero", position: 0 },
      { note_id: id, text: "Segundo", position: 1 },
    ]);
    expect(error).toBeNull();
    const { data } = await owner.client
      .from("note_items")
      .select("id, text, done, done_at")
      .eq("note_id", id)
      .order("position");
    expect(data?.map((item) => item.text)).toEqual([
      "Primero",
      "Segundo",
      "Tercero",
    ]);
    expect(data?.every((item) => !item.done && item.done_at === null)).toBe(
      true,
    );

    await owner.client
      .from("note_items")
      .update({ done: true })
      .eq("id", data![0]!.id);
    const done = await owner.client
      .from("note_items")
      .select("done, done_at")
      .eq("id", data![0]!.id)
      .single();
    expect(done.data?.done).toBe(true);
    expect(done.data?.done_at).not.toBeNull();
    // done_at is the database's, never the client's.
    const forged = await owner.client
      .from("note_items")
      .update({ done_at: "2000-01-01T00:00:00Z" } as never)
      .eq("id", data![0]!.id);
    expect(forged.error?.code).toBe("42501");
  });

  it("only belong to a list, with text, and never more than 200 (CF429 items)", async () => {
    const text = await note(owner, { kind: "text" });
    const inText = await owner.client
      .from("note_items")
      .insert({ note_id: text, text: "No" });
    expect(inText.error?.code).toBe("22023");

    const id = await note(owner);
    const blank = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "   " });
    expect(blank.error?.code).toBe("23514");

    const many = Array.from({ length: 200 }, (_, position) => ({
      note_id: id,
      text: `Elemento ${position}`,
      position,
    }));
    expect((await admin.from("note_items").insert(many)).error).toBeNull();
    const extra = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "Uno más" });
    expect(extra.error?.code).toBe("CF429");
    expect(extra.error?.message).toBe("items");
  });
});

describe("the limit of notes", () => {
  it("refuses the 501st note of an author (CF429 notes)", async () => {
    const hoarder = await createTestUser({ display_name: "Lola" });
    extraUsers.push(hoarder.id);
    const rows = Array.from({ length: 500 }, (_, index) => ({
      owner_id: hoarder.id,
      title: `Nota ${index}`,
    }));
    expect((await admin.from("notes").insert(rows)).error).toBeNull();
    const extra = await hoarder.client.from("notes").insert({ title: "501" });
    expect(extra.error?.code).toBe("CF429");
    expect(extra.error?.message).toBe("notes");
  });
});

describe("a note shared through a calendar", () => {
  it("is read by its members, written by owner and editors, never by a viewer or a stranger", async () => {
    const id = await note(editor, { calendar_id: calendar, title: "Casa" });

    expect(await seen(owner, id)).toBe(1);
    expect(await seen(viewer, id)).toBe(1);
    expect(await seen(stranger, id)).toBe(0);

    const byOwner = await owner.client
      .from("note_items")
      .insert({ note_id: id, text: "Pan" })
      .select("id")
      .single();
    expect(byOwner.error).toBeNull();
    const byViewer = await viewer.client
      .from("note_items")
      .insert({ note_id: id, text: "Leche" });
    expect(byViewer.error?.code).toBe("42501");
    const tick = await viewer.client
      .from("note_items")
      .update({ done: true })
      .eq("id", byOwner.data!.id)
      .select("id");
    expect(tick.data).toEqual([]);
    const rename = await viewer.client
      .from("notes")
      .update({ title: "Cambiada" })
      .eq("id", id)
      .select("id");
    expect(rename.data).toEqual([]);
    // A viewer reads the items too.
    const items = await viewer.client
      .from("note_items")
      .select("text")
      .eq("note_id", id);
    expect(items.data).toEqual([{ text: "Pan" }]);
  });

  it("cannot be created where the user cannot write", async () => {
    const asViewer = await viewer.client
      .from("notes")
      .insert({ title: "No", calendar_id: calendar });
    expect(asViewer.error?.code).toBe("42501");
    const asStranger = await stranger.client
      .from("notes")
      .insert({ title: "No", calendar_id: calendar });
    expect(asStranger.error?.code).toBe("42501");
  });

  it("is deleted by its author or by the calendar's owner, not by another editor", async () => {
    const other = await createTestUser({ display_name: "Edu" });
    extraUsers.push(other.id);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: calendar, user_id: other.id, role: "editor" });
    const id = await note(editor, { calendar_id: calendar });

    const byOther = await other.client
      .from("notes")
      .delete()
      .eq("id", id)
      .select("id");
    expect(byOther.data).toEqual([]);
    const byOwner = await owner.client
      .from("notes")
      .delete()
      .eq("id", id)
      .select("id");
    expect(byOwner.data).toHaveLength(1);

    const own = await note(editor, { calendar_id: calendar });
    const byAuthor = await editor.client
      .from("notes")
      .delete()
      .eq("id", own)
      .select("id");
    expect(byAuthor.data).toHaveLength(1);
  });

  it("is only made personal, or moved, by its author", async () => {
    const id = await note(editor, { calendar_id: calendar });
    const other = await owner.client
      .from("notes")
      .update({ calendar_id: null })
      .eq("id", id);
    expect(other.error).not.toBeNull();

    const mine = await editor.client
      .from("notes")
      .update({ calendar_id: null })
      .eq("id", id)
      .select("id");
    expect(mine.data).toHaveLength(1);
    expect(await seen(owner, id)).toBe(0);
    expect(await seen(editor, id)).toBe(1);
  });

  it("stays in the calendar, without author, when who wrote it leaves", async () => {
    const leaver = await createTestUser({ display_name: "Lía" });
    extraUsers.push(leaver.id);
    await admin
      .from("calendar_members")
      .insert({ calendar_id: calendar, user_id: leaver.id, role: "editor" });
    const shared = await note(leaver, { calendar_id: calendar, title: "Suya" });
    const personal = await note(leaver, { title: "Privada" });

    const left = await leaver.client
      .from("calendar_members")
      .delete()
      .eq("calendar_id", calendar)
      .eq("user_id", leaver.id);
    expect(left.error).toBeNull();

    expect(await seen(leaver, shared)).toBe(0);
    expect(await seen(leaver, personal)).toBe(1);
    expect(await seen(owner, shared)).toBe(1);
    const { data } = await admin
      .from("notes")
      .select("owner_id")
      .eq("id", shared)
      .single();
    expect(data?.owner_id).toBeNull();
  });
});

describe("deleting things around a note", () => {
  it("deleting the account deletes the personal notes and leaves the shared ones", async () => {
    const gone = await createTestUser({ display_name: "Ivo" });
    await admin
      .from("calendar_members")
      .insert({ calendar_id: calendar, user_id: gone.id, role: "editor" });
    const personal = await note(gone, { title: "Privada" });
    const shared = await note(gone, {
      calendar_id: calendar,
      title: "De casa",
    });
    await gone.client
      .from("note_items")
      .insert({ note_id: shared, text: "Pan" });

    await deleteTestUser(gone.id);

    const { data } = await admin
      .from("notes")
      .select("id, owner_id, note_items(text)")
      .in("id", [personal, shared]);
    expect(data).toEqual([
      { id: shared, owner_id: null, note_items: [{ text: "Pan" }] },
    ]);
  });

  it("deleting the calendar deletes its notes", async () => {
    const { data: extra } = await admin
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Temporal" })
      .select("id")
      .single();
    const id = await note(owner, { calendar_id: extra!.id });
    await owner.client.from("calendars").delete().eq("id", extra!.id);
    expect((await admin.from("notes").select("id").eq("id", id)).data).toEqual(
      [],
    );
  });

  it("merging calendars moves their notes to the one that stays (plan D10)", async () => {
    const { data: created } = await admin
      .from("calendars")
      .insert([
        { owner_id: owner.id, name: "Uno" },
        { owner_id: owner.id, name: "Dos" },
      ])
      .select("id");
    const [one, two] = created!.map((row) => row.id);
    const id = await note(owner, { calendar_id: two, title: "Del segundo" });
    await owner.client.from("note_items").insert({ note_id: id, text: "Pan" });

    const merged = await owner.client.rpc("merge_calendars", {
      p_source_ids: [one!, two!],
      p_target_id: one!,
    });
    expect(merged.error).toBeNull();

    const { data } = await admin
      .from("notes")
      .select("calendar_id, note_items(text)")
      .eq("id", id)
      .single();
    expect(data).toEqual({ calendar_id: one, note_items: [{ text: "Pan" }] });
  });

  it("a copy of a calendar without owner carries its notes (plan D10)", async () => {
    const { data: source } = await admin
      .from("calendars")
      .insert({ owner_id: owner.id, name: "Compartido" })
      .select("id")
      .single();
    const id = await note(owner, { calendar_id: source!.id, title: "Lista" });
    const items = await owner.client.from("note_items").insert([
      { note_id: id, text: "Hecho", done: true, position: 0 },
      { note_id: id, text: "Pendiente", done: false, position: 1 },
    ]);
    expect(items.error).toBeNull();

    const copy = await admin.rpc("copy_calendar_for_owner", {
      p_calendar_id: source!.id,
      p_user_id: editor.id,
    });
    expect(copy.error).toBeNull();

    const { data } = await admin
      .from("notes")
      .select("owner_id, title, kind, note_items(text, done, position)")
      .eq("calendar_id", copy.data as string)
      .order("position", { referencedTable: "note_items" });
    expect(data).toEqual([
      {
        owner_id: editor.id,
        title: "Lista",
        kind: "list",
        note_items: [
          { text: "Hecho", done: true, position: 0 },
          { text: "Pendiente", done: false, position: 1 },
        ],
      },
    ]);
    // The original is untouched.
    expect(await seen(owner, id)).toBe(1);
  });
});
