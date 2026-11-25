// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { AssistantAction } from "@/lib/assistant/actions";
import { describeAction } from "@/lib/assistant/actions";
import { assistantUndoSchema } from "@/lib/assistant/schemas";

// Spec 048, T6: Venito creates notes and adds items (RF-12, RF-13), with a
// card and "Deshacer" that only takes back what it wrote.
const roles = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notes/queries", () => ({ getNoteRoles: roles }));

const { noteWriteTools, undoNote } =
  await import("@/app/dashboard/assistant/note-writes");

interface Call {
  table: string;
  op: string;
  values?: unknown;
  filters: [string, unknown][];
}

/** A client that records each call and answers with `respond`. */
function fake(respond: (call: Call) => { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    const chain: Record<string, unknown> = {};
    const self = (op?: string, values?: unknown) => {
      if (op) {
        call.op = op;
        call.values = values;
      }
      return chain;
    };
    Object.assign(chain, {
      insert: (values: unknown) => self("insert", values),
      delete: () => self("delete"),
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      eq: (column: string, value: unknown) => (
        call.filters.push([column, value]),
        chain
      ),
      in: (column: string, value: unknown) => (
        call.filters.push([column, value]),
        chain
      ),
      single: () => chain,
      maybeSingle: () => chain,
      then: (resolve: (value: unknown) => void) => {
        calls.push(call);
        resolve(respond(call));
      },
    });
    return chain;
  };
  return { client: { from } as never, calls };
}

function tools(respond: Parameters<typeof fake>[0], count = { used: 0 }) {
  const { client, calls } = fake(respond);
  const actions: AssistantAction[] = [];
  const reserve = (n: number) => {
    if (count.used + n > 3) return false;
    count.used += n;
    return true;
  };
  const writes = noteWriteTools(
    { supabase: client, userId: "me", onAction: (a) => actions.push(a) },
    reserve,
    () => ({ status: "too_many" }),
  );
  return { writes, calls, actions };
}

const NOTE = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";

describe("create_notes", () => {
  it("creates a list with its items, personal, and a card that undoes it", async () => {
    const { writes, calls, actions } = tools((call) =>
      call.table === "notes" && call.op === "insert"
        ? { data: { id: NOTE }, error: null }
        : call.table === "notes"
          ? { data: { updated_at: "t1" }, error: null }
          : call.op === "insert"
            ? { data: [{ id: "i1" }, { id: "i2" }], error: null }
            : { data: [], error: null },
    );
    const answer = await writes.create_notes({
      notes: [{ title: "Maleta", items: ["bañador", "crema"] }],
    });
    expect(answer).toMatchObject({
      status: "created",
      items: ["bañador", "crema"],
    });
    expect(
      calls.find((c) => c.table === "notes" && c.op === "insert")?.values,
    ).toEqual({
      kind: "list",
      title: "Maleta",
      body: "",
      calendar_id: null,
    });
    expect(
      calls.find((c) => c.table === "note_items" && c.op === "insert")?.values,
    ).toEqual([
      { note_id: NOTE, text: "bañador", position: 0 },
      { note_id: NOTE, text: "crema", position: 1 },
    ]);
    expect(actions[0]).toMatchObject({
      kind: "note",
      added: false,
      note: { id: NOTE, title: "Maleta", calendarName: null },
      undo: { kind: "unnote", id: NOTE, updatedAt: "t1" },
    });
    expect(
      assistantUndoSchema.safeParse(
        actions[0]!.kind === "note" && actions[0].undo,
      ).success,
    ).toBe(true);
    expect(describeAction(actions[0]!, "Europe/Madrid", "done")).toBe(
      "[Nota creada «Maleta»: bañador, crema]",
    );
  });

  it("shares it in a calendar named as the user says, never one they only read", async () => {
    roles.mockResolvedValue([
      { calendarId: "c1", name: "Casa", role: "editor" },
      { calendarId: "c2", name: "Uni", role: "viewer" },
    ]);
    const { writes, calls } = tools((call) =>
      call.op === "insert"
        ? { data: { id: NOTE }, error: null }
        : { data: { updated_at: "t" }, error: null },
    );
    await writes.create_notes({
      notes: [{ title: "Menú", text: "Lunes: lentejas", calendar: "casa" }],
    });
    expect(calls[0]?.values).toMatchObject({
      kind: "text",
      body: "Lunes: lentejas",
      calendar_id: "c1",
    });
    const refused = await writes.create_notes({
      notes: [{ title: "x", calendar: "uni" }],
    });
    expect(refused.status).toBe("read_only");
  });

  it("counts in the 3 writes of a message", async () => {
    const count = { used: 2 };
    const { writes, calls } = tools(() => ({ data: null, error: null }), count);
    expect(
      await writes.create_notes({ notes: [{ title: "a" }, { title: "b" }] }),
    ).toEqual({ status: "too_many" });
    expect(calls).toEqual([]);
  });
});

describe("add_note_items", () => {
  const lists = [
    {
      id: NOTE,
      title: "Lista de la compra",
      calendar_id: null,
      calendars: null,
    },
    {
      id: "n2",
      title: "Regalos de Navidad",
      calendar_id: "c1",
      calendars: { name: "Casa" },
    },
  ];

  it("adds at the end of the list named without accents, with a card that removes only those", async () => {
    const { writes, calls, actions } = tools((call) =>
      call.table === "notes"
        ? { data: lists, error: null }
        : call.op === "insert"
          ? { data: [{ id: "i8" }, { id: "i9" }], error: null }
          : { data: [{ position: 6.5 }], error: null },
    );
    const answer = await writes.add_note_items({
      note: "la lista de la COMPRA",
      items: ["leche", "pan"],
    });
    expect(answer).toEqual({
      status: "added",
      note: "Lista de la compra",
      items: ["leche", "pan"],
    });
    expect(calls.find((c) => c.op === "insert")?.values).toEqual([
      { note_id: NOTE, text: "leche", position: 7.5 },
      { note_id: NOTE, text: "pan", position: 8.5 },
    ]);
    expect(actions[0]).toMatchObject({
      kind: "note",
      added: true,
      undo: { kind: "unnote", id: NOTE, itemIds: ["i8", "i9"] },
    });
  });

  it("asks before creating a list that is not there, and among several", async () => {
    const { writes, calls } = tools((call) =>
      call.table === "notes"
        ? { data: lists, error: null }
        : { data: [], error: null },
    );
    const missing = await writes.add_note_items({
      note: "deberes",
      items: ["mates"],
    });
    expect(missing).toMatchObject({ status: "not_found" });
    expect(missing).not.toHaveProperty("notice");
    expect(
      await writes.add_note_items({ note: "regalos navidad", items: ["vela"] }),
    ).toMatchObject({ status: "added" });
    expect(calls.filter((c) => c.op === "insert")).toHaveLength(1);
  });
});

describe("undoNote", () => {
  it("removes only the items it added", async () => {
    const { client, calls } = fake(() => ({ data: null, error: null }));
    expect(
      await undoNote(client, {
        kind: "unnote",
        id: NOTE,
        updatedAt: "",
        itemIds: ["i8"],
      }),
    ).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({
      table: "note_items",
      op: "delete",
      filters: [
        ["note_id", NOTE],
        ["id", ["i8"]],
      ],
    });
  });

  it("deletes the note it created only while nobody changed it", async () => {
    const changed = fake(() => ({ data: { updated_at: "t2" }, error: null }));
    expect(
      await undoNote(changed.client, {
        kind: "unnote",
        id: NOTE,
        updatedAt: "t1",
      }),
    ).toMatchObject({ ok: false });
    expect(changed.calls.some((c) => c.op === "delete")).toBe(false);

    const same = fake((call) =>
      call.op === "delete"
        ? { data: [{ id: NOTE }], error: null }
        : { data: { updated_at: "t1" }, error: null },
    );
    expect(
      await undoNote(same.client, {
        kind: "unnote",
        id: NOTE,
        updatedAt: "t1",
      }),
    ).toEqual({ ok: true });
  });
});
