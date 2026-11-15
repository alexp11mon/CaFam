"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { requireActionUser } from "@/lib/calendar/queries";
import { getNoteErrorMessage, NOTE_MESSAGES } from "@/lib/notes/error-messages";
import {
  createNoteSchema,
  itemChangeSchema,
  newItemSchema,
  noteFieldsSchema,
  noteIdSchema,
  positionsSchema,
  restoreItemSchema,
} from "@/lib/notes/schemas";

// The writes of notes (spec 028 RF-4 to RF-9, plan D4, D5, D7, D8). Each one
// changes a single thing, so the browser can show it at once and undo just
// that if it fails. RLS decides who may (P3): a write that touches no row is
// a note that is gone or not the user's to change.

export type NoteResult = { error?: string };

const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? NOTE_MESSAGES.invalid;

/** The list and the note read again on their next visit. */
function refresh() {
  revalidatePath("/dashboard/notes", "layout");
}

export interface NewNoteState {
  error?: string;
  values?: { title: string; kind: string; calendarId: string };
}

/** The form of `/dashboard/notes/new` (RF-4): creates and opens the note. */
export async function createNote(
  _previous: NewNoteState,
  formData: FormData,
): Promise<NewNoteState> {
  const values = {
    title: String(formData.get("title") ?? ""),
    kind: String(formData.get("kind") ?? "list"),
    calendarId: String(formData.get("calendarId") ?? ""),
  };
  const parsed = createNoteSchema.safeParse({
    id: crypto.randomUUID(),
    kind: values.kind,
    title: values.title,
    calendarId: values.calendarId || null,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), values };

  const { supabase } = await requireActionUser();
  const { id, kind, title, calendarId } = parsed.data;
  let failure: string | undefined;
  try {
    const { error } = await supabase
      .from("notes")
      .insert({ id, kind, title, calendar_id: calendarId });
    if (error) failure = getNoteErrorMessage(error);
  } catch {
    failure = NOTE_MESSAGES.connection;
  }
  if (failure) return { error: failure, values };
  refresh();
  redirect(`/dashboard/notes/${id}`);
}

export async function updateNote(
  noteId: string,
  fields: unknown,
): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(noteId);
  const parsed = noteFieldsSchema.safeParse(fields);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { title, body, color, pinned, archived, dueDate, calendarId } =
    parsed.data;

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("notes")
      .update({
        ...(title !== undefined ? { title } : {}),
        ...(body !== undefined ? { body } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(pinned !== undefined ? { pinned } : {}),
        ...(archived !== undefined ? { archived } : {}),
        ...(dueDate !== undefined ? { due_date: dueDate } : {}),
        ...(calendarId !== undefined ? { calendar_id: calendarId } : {}),
      })
      .eq("id", id.data)
      .select("id");
    if (error) return { error: getNoteErrorMessage(error) };
    if (!data?.length) return { error: NOTE_MESSAGES.gone };
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  refresh();
  return {};
}

export async function deleteNote(noteId: string): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(noteId);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id.data)
      .select("id");
    if (error) return { error: getNoteErrorMessage(error) };
    if (!data?.length) return { error: NOTE_MESSAGES.gone };
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  refresh();
  return {};
}

/** A new item, or one put back by "Deshacer" (plan D8), with its own id. */
export async function addItem(
  noteId: string,
  item: unknown,
): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(noteId);
  const withDone = restoreItemSchema.safeParse(item);
  const parsed = withDone.success ? withDone : newItemSchema.safeParse(item);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase.from("note_items").insert({
      id: parsed.data.id,
      note_id: id.data,
      text: parsed.data.text,
      position: parsed.data.position,
      done: withDone.success ? withDone.data.done : false,
    });
    // RLS refuses the insert of who cannot write the note.
    if (error) {
      return {
        error:
          error.code === "42501"
            ? NOTE_MESSAGES.gone
            : getNoteErrorMessage(error),
      };
    }
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  return {};
}

export async function updateItem(
  itemId: string,
  change: unknown,
): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(itemId);
  const parsed = itemChangeSchema.safeParse(change);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("note_items")
      .update(parsed.data)
      .eq("id", id.data)
      .select("id");
    if (error) return { error: getNoteErrorMessage(error) };
    if (!data?.length) return { error: NOTE_MESSAGES.gone };
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  return {};
}

/** The new positions of the items that moved (plan D7). */
export async function moveItems(
  noteId: string,
  positions: unknown,
): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(noteId);
  const parsed = positionsSchema.safeParse(positions);
  if (!id.success || !parsed.success) return { error: NOTE_MESSAGES.invalid };

  const { supabase } = await requireActionUser();
  try {
    const results = await Promise.all(
      parsed.data.map(({ id: itemId, position }) =>
        supabase
          .from("note_items")
          .update({ position })
          .eq("id", itemId)
          .eq("note_id", id.data)
          .select("id"),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) return { error: getNoteErrorMessage(failed.error) };
    if (results.some((result) => !result.data?.length)) {
      return { error: NOTE_MESSAGES.gone };
    }
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  return {};
}

export async function deleteItem(itemId: string): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(itemId);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase
      .from("note_items")
      .delete()
      .eq("id", id.data)
      .select("id");
    if (error) return { error: getNoteErrorMessage(error) };
    if (!data?.length) return { error: NOTE_MESSAGES.gone };
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  return {};
}

/** "Borrar los completados" (RF-6). */
export async function clearDone(noteId: string): Promise<NoteResult> {
  const id = noteIdSchema.safeParse(noteId);
  if (!id.success) return { error: NOTE_MESSAGES.gone };
  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("note_items")
      .delete()
      .eq("note_id", id.data)
      .eq("done", true);
    if (error) return { error: getNoteErrorMessage(error) };
  } catch {
    return { error: NOTE_MESSAGES.connection };
  }
  return {};
}
