// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 028, T3: the writes of notes validate, translate and tell a note that
// is gone from a failure (RF-4 to RF-9, RF-13).
const db = vi.hoisted(() => ({
  calls: [] as {
    table: string;
    op: string;
    values?: unknown;
    filters: unknown[];
  }[],
  result: { data: [{ id: "x" }], error: null } as {
    data: unknown[] | null;
    error: { code?: string; message?: string } | null;
  },
  throws: false,
}));

function table(name: string) {
  const call = {
    table: name,
    op: "",
    values: undefined as unknown,
    filters: [] as unknown[],
  };
  const chain = {
    insert(values: unknown) {
      call.op = "insert";
      call.values = values;
      db.calls.push(call);
      return chain;
    },
    update(values: unknown) {
      call.op = "update";
      call.values = values;
      db.calls.push(call);
      return chain;
    },
    delete() {
      call.op = "delete";
      db.calls.push(call);
      return chain;
    },
    eq(column: string, value: unknown) {
      call.filters.push([column, value]);
      return chain;
    },
    select() {
      return chain;
    },
    then(
      resolve: (value: typeof db.result) => void,
      reject: (e: unknown) => void,
    ) {
      if (db.throws) reject(new TypeError("fetch failed"));
      else resolve(db.result);
    },
  };
  return chain;
}

const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: { from: table }, userId: "me" }),
}));

const actions = await import("@/app/dashboard/notes/actions");

const NOTE = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const ITEM = "0d3b7f7e-51a4-4d0e-8a57-5f1c8b6f2a22";

beforeEach(() => {
  db.calls = [];
  db.result = { data: [{ id: "x" }], error: null };
  db.throws = false;
  revalidatePath.mockClear();
  redirect.mockClear();
});

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("createNote", () => {
  it("creates the note with an id of its own and opens it", async () => {
    await expect(
      actions.createNote(
        {},
        form({ title: " Deberes ", kind: "list", calendarId: "" }),
      ),
    ).rejects.toThrow(/REDIRECT \/dashboard\/notes\/[0-9a-f-]{36}$/);
    expect(db.calls[0]).toMatchObject({
      table: "notes",
      op: "insert",
      values: { kind: "list", title: "Deberes", calendar_id: null },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/notes", "layout");
  });

  it("gives back what was written when it cannot be created", async () => {
    db.result = { data: null, error: { code: "CF429", message: "notes" } };
    const state = await actions.createNote(
      {},
      form({ title: "Otra", kind: "text", calendarId: NOTE }),
    );
    expect(state.error).toContain("500 notas");
    expect(state.values).toEqual({
      title: "Otra",
      kind: "text",
      calendarId: NOTE,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a kind that does not exist without asking the database", async () => {
    const state = await actions.createNote(
      {},
      form({ title: "", kind: "audio" }),
    );
    expect(state.error).toBe("Elige lista o texto.");
    expect(db.calls).toHaveLength(0);
  });
});

describe("updateNote", () => {
  it("writes only what changed, with the database's names", async () => {
    expect(
      await actions.updateNote(NOTE, { pinned: true, dueDate: "2026-11-19" }),
    ).toEqual({});
    expect(db.calls[0]).toMatchObject({
      op: "update",
      values: { pinned: true, due_date: "2026-11-19" },
      filters: [["id", NOTE]],
    });
  });

  it("says the note is gone when no row changes (RLS hides it)", async () => {
    db.result = { data: [], error: null };
    expect((await actions.updateNote(NOTE, { title: "x" })).error).toBe(
      "Esta nota ya no existe o no tienes permiso para cambiarla.",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("validates before writing and tells a lost connection apart", async () => {
    expect((await actions.updateNote(NOTE, { color: "#000000" })).error).toBe(
      "Elige un color de la lista.",
    );
    expect(db.calls).toHaveLength(0);
    db.throws = true;
    expect((await actions.updateNote(NOTE, { title: "x" })).error).toContain(
      "conectar",
    );
  });
});

describe("items", () => {
  it("adds an item with its id, and puts one back as it was", async () => {
    await actions.addItem(NOTE, { id: ITEM, text: " Pan ", position: 3 });
    expect(db.calls[0]).toMatchObject({
      table: "note_items",
      op: "insert",
      values: {
        id: ITEM,
        note_id: NOTE,
        text: "Pan",
        position: 3,
        done: false,
      },
    });
    await actions.addItem(NOTE, {
      id: ITEM,
      text: "Pan",
      position: 3,
      done: true,
    });
    expect(db.calls[1]!.values).toMatchObject({ done: true });
  });

  it("translates the limit and a refused insert", async () => {
    db.result = { data: null, error: { code: "CF429", message: "items" } };
    expect(
      (await actions.addItem(NOTE, { id: ITEM, text: "Pan", position: 0 }))
        .error,
    ).toContain("200 elementos");
    db.result = { data: null, error: { code: "42501" } };
    expect(
      (await actions.addItem(NOTE, { id: ITEM, text: "Pan", position: 0 }))
        .error,
    ).toContain("ya no existe o no tienes permiso");
    expect(
      (await actions.addItem(NOTE, { id: ITEM, text: "  ", position: 0 }))
        .error,
    ).toBe("Escribe algo para añadirlo.");
  });

  it("ticks, renames, moves and deletes one item at a time", async () => {
    await actions.updateItem(ITEM, { done: true });
    await actions.moveItems(NOTE, [
      { id: ITEM, position: 0 },
      { id: NOTE, position: 1 },
    ]);
    await actions.deleteItem(ITEM);
    await actions.clearDone(NOTE);
    expect(
      db.calls.map((call) => [call.op, call.values ?? call.filters]),
    ).toEqual([
      ["update", { done: true }],
      ["update", { position: 0 }],
      ["update", { position: 1 }],
      ["delete", [["id", ITEM]]],
      [
        "delete",
        [
          ["note_id", NOTE],
          ["done", true],
        ],
      ],
    ]);
    // An item changing does not repaint the whole section.
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("says so when the item is gone", async () => {
    db.result = { data: [], error: null };
    for (const result of [
      await actions.updateItem(ITEM, { done: true }),
      await actions.deleteItem(ITEM),
      await actions.moveItems(NOTE, [{ id: ITEM, position: 0 }]),
    ]) {
      expect(result.error).toContain("ya no existe");
    }
  });
});

describe("deleteNote", () => {
  it("deletes it and refreshes the list", async () => {
    expect(await actions.deleteNote(NOTE)).toEqual({});
    expect(db.calls[0]).toMatchObject({ table: "notes", op: "delete" });
    expect(revalidatePath).toHaveBeenCalled();
    expect((await actions.deleteNote("nope")).error).toContain("ya no existe");
  });
});
