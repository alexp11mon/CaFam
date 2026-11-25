import { z } from "zod";
import type { AssistantAction, AssistantUndo } from "@/lib/assistant/actions";
import { matchCalendar } from "@/lib/assistant/calendar-match";
import { getNoteRoles } from "@/lib/notes/queries";
import { ITEM_TEXT_MAX, NOTE_TITLE_MAX } from "@/lib/notes/limits";
import { matchNote } from "@/lib/notes/match";
import { getNoteErrorMessage } from "@/lib/notes/error-messages";
import type { Supabase } from "../events/event-writes";

// Spec 048, T6: Venito creates notes and adds items to a list (RF-12, RF-13),
// right away, with a card and "Deshacer", as the events of spec 036. It never
// deletes a note: undoing only takes back what it just wrote. Not a "use
// server" file: the route checks the session, and RLS decides again here.

type ToolAnswer = Record<string, unknown> & { status: string };

export const NOTE_TEXTS = {
  undoChanged: "Esta nota ha cambiado entretanto; no se ha deshecho.",
} as const;

/** Items of one message (a shopping list said aloud is rarely longer). */
const ITEMS_PER_CALL = 20;
const itemTexts = z
  .array(z.string().trim().min(1).max(ITEM_TEXT_MAX))
  .max(ITEMS_PER_CALL);
const nullable = (schema: z.ZodString) =>
  schema.nullish().transform((value) => value ?? null);

export const createNotesArgsSchema = z.object({
  notes: z
    .array(
      z.object({
        title: z.string().trim().max(NOTE_TITLE_MAX),
        kind: z.enum(["list", "text"]).nullish(),
        items: itemTexts.nullish(),
        text: nullable(z.string().max(5000)),
        calendar: nullable(z.string().max(100)),
      }),
    )
    .min(1),
});

export const addNoteItemsArgsSchema = z.object({
  note: z.string().trim().min(1).max(NOTE_TITLE_MAX),
  items: itemTexts.min(1),
});

interface NoteWritesContext {
  supabase: Supabase;
  userId: string;
  signal?: AbortSignal;
  onAction: (action: AssistantAction) => void;
}

async function updatedAtOfNote(supabase: Supabase, id: string) {
  const { data } = await supabase
    .from("notes")
    .select("updated_at")
    .eq("id", id)
    .maybeSingle();
  return data?.updated_at ?? "";
}

/**
 * The note tools of one answer. `reserve` is the count of writes shared with
 * the events (at most 3 per message, RF-12).
 */
export function noteWriteTools(
  ctx: NoteWritesContext,
  reserve: (count: number) => boolean,
  tooMany: () => ToolAnswer,
) {
  async function insertItems(noteId: string, texts: string[]) {
    const { data: last } = await ctx.supabase
      .from("note_items")
      .select("position")
      .eq("note_id", noteId)
      .order("position", { ascending: false })
      .limit(1);
    const start = (last?.[0]?.position ?? -1) + 1;
    return ctx.supabase
      .from("note_items")
      .insert(
        texts.map((text, index) => ({
          note_id: noteId,
          text,
          position: start + index,
        })),
      )
      .select("id");
  }

  async function createOne(
    input: z.infer<typeof createNotesArgsSchema>["notes"][number],
  ): Promise<ToolAnswer> {
    if (ctx.signal?.aborted) return { status: "cancelled" };
    let calendar: { id: string; name: string } | null = null;
    if (input.calendar) {
      const roles = await getNoteRoles(ctx.supabase, ctx.userId);
      const match = matchCalendar(
        input.calendar,
        roles.map((role) => ({
          id: role.calendarId,
          name: role.name,
          writable: role.role !== "viewer",
          reason: role.role === "viewer" ? ("viewer" as const) : null,
        })),
      );
      if (match.status !== "ok") return { ...match, status: match.status };
      calendar = match.calendar;
    }
    const items = input.items ?? [];
    const kind = input.kind ?? (input.text && !items.length ? "text" : "list");
    const { data: note, error } = await ctx.supabase
      .from("notes")
      .insert({
        kind,
        title: input.title,
        body: kind === "text" ? (input.text ?? "") : "",
        calendar_id: calendar?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !note) {
      return { status: "failed", notice: getNoteErrorMessage(error) };
    }
    if (kind === "list" && items.length) {
      const written = await insertItems(note.id, items);
      if (written.error) {
        return {
          status: "failed",
          notice: getNoteErrorMessage(written.error),
        };
      }
    }
    const shownItems = kind === "list" ? items : [];
    ctx.onAction({
      kind: "note",
      key: crypto.randomUUID(),
      note: {
        id: note.id,
        title: input.title,
        items: shownItems,
        calendarName: calendar?.name ?? null,
      },
      added: false,
      undo: {
        kind: "unnote",
        id: note.id,
        updatedAt: await updatedAtOfNote(ctx.supabase, note.id),
      },
    });
    return {
      status: "created",
      title: input.title,
      items: shownItems,
      calendar: calendar?.name ?? "personal",
    };
  }

  return {
    /** RF-12: 1 to 3 notes, with their items, right away. */
    async create_notes(args: unknown): Promise<ToolAnswer> {
      const parsed = createNotesArgsSchema.safeParse(args);
      if (!parsed.success) return { status: "invalid_arguments" };
      if (!reserve(parsed.data.notes.length)) return tooMany();
      const results: ToolAnswer[] = [];
      for (const input of parsed.data.notes)
        results.push(await createOne(input));
      return results.length === 1 ? results[0]! : { status: "done", results };
    },

    /** RF-12, RF-13: items at the end of a list named as the user says it. */
    async add_note_items(args: unknown): Promise<ToolAnswer> {
      const parsed = addNoteItemsArgsSchema.safeParse(args);
      if (!parsed.success) return { status: "invalid_arguments" };
      if (!reserve(1)) return tooMany();
      if (ctx.signal?.aborted) return { status: "cancelled" };
      const { data: lists, error } = await ctx.supabase
        .from("notes")
        .select("id, title, calendar_id, calendars(name)")
        .eq("kind", "list")
        .eq("archived", false);
      if (error)
        return { status: "failed", notice: getNoteErrorMessage(error) };
      const match = matchNote(parsed.data.note, lists ?? []);
      // The prompt has Venito ask whether to create it (RF-13); a notice
      // would reach the answer word for word.
      if (match.status === "not_found") return match;
      if (match.status === "ambiguous") return match;
      const note = match.note;
      const written = await insertItems(note.id, parsed.data.items);
      if (written.error || !written.data) {
        return {
          status: "failed",
          notice: getNoteErrorMessage(written.error),
        };
      }
      const calendarName =
        (note.calendars as unknown as { name: string } | null)?.name ?? null;
      ctx.onAction({
        kind: "note",
        key: crypto.randomUUID(),
        note: {
          id: note.id,
          title: note.title,
          items: parsed.data.items,
          calendarName,
        },
        added: true,
        undo: {
          kind: "unnote",
          id: note.id,
          updatedAt: "",
          itemIds: written.data.map((row) => row.id),
        },
      });
      return { status: "added", note: note.title, items: parsed.data.items };
    },
  };
}

/**
 * "Deshacer" of a note card: the items Venito added, or the note it created
 * if nobody changed it since (spec 048 RF-12).
 */
export async function undoNote(
  supabase: Supabase,
  undo: Extract<AssistantUndo, { kind: "unnote" }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (undo.itemIds) {
    const { error } = await supabase
      .from("note_items")
      .delete()
      .eq("note_id", undo.id)
      .in("id", undo.itemIds);
    return error
      ? { ok: false, error: getNoteErrorMessage(error) }
      : { ok: true };
  }
  if ((await updatedAtOfNote(supabase, undo.id)) !== undo.updatedAt) {
    return { ok: false, error: NOTE_TEXTS.undoChanged };
  }
  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", undo.id)
    .select("id");
  if (error) return { ok: false, error: getNoteErrorMessage(error) };
  return data?.length
    ? { ok: true }
    : { ok: false, error: NOTE_TEXTS.undoChanged };
}
