import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import {
  canSeeCalendar,
  getEvent,
  type EventRecord,
} from "@/lib/calendar/queries";
import type { EventData } from "@/lib/calendar/schemas";
import { getNoteErrorMessage, NOTE_MESSAGES } from "@/lib/notes/error-messages";
import { getNote } from "@/lib/notes/queries";
import type { Note } from "@/lib/notes/types";
import { createVerdict, verdictOrGone } from "@/lib/offline/conflict";
import { OFFLINE_MESSAGES } from "@/lib/offline/messages";
import type { NoteFields } from "@/lib/offline/outbox";
import type { ParsedChange } from "@/lib/offline/schemas";
import {
  changeOccurrence,
  createSingle,
  deleteOccurrences,
  deleteSingle,
  isSyncedCalendar,
  toRow,
  updateSingle,
  type Supabase,
} from "./events/event-writes";
import { seriesValues } from "./events/quick-writes";

// Applies one change made offline with the user's session (spec 034 RF-41,
// RF-46, RF-47, RF-50 to RF-55, RF-58; plan D5 to D8). It reuses the writes
// of always, so RLS and the limits decide as with a connection (RNF-5).

type Fields = Record<string, unknown>;
/** EventData is an interface: plain fields for the comparisons of conflict.ts. */
const fields = (value: object) => value as Fields;

export type ApplyResult =
  | { status: "applied" }
  | { status: "conflict"; server: Fields | null }
  | { status: "rejected"; reason: string }
  | { status: "retry" };

const APPLIED: ApplyResult = { status: "applied" };

/** A message of the writes of always: the network is "retry", the rest "rejected". */
function failed(message: string | undefined): ApplyResult {
  if (!message || message === CALENDAR_MESSAGES.connection) {
    return { status: "retry" };
  }
  if (message === NOTE_MESSAGES.connection) return { status: "retry" };
  return { status: "rejected", reason: message };
}

function eventData(event: EventRecord): EventData {
  return {
    title: event.title,
    calendarId: event.calendarId,
    allDay: event.allDay,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    description: event.description,
    location: event.location,
    color: event.color,
    categoryId: event.categoryId,
  };
}

type EventChange = Extract<ParsedChange, { type: `event.${string}` }>;

async function applyEvent(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  change: EventChange,
  force: boolean,
): Promise<ApplyResult> {
  const server = await getEvent(supabase, change.id);
  const current = server ? fields(eventData(server)) : null;

  if (change.type === "event.create") {
    const verdict = createVerdict(fields(change.data), current);
    if (verdict === "applied") return APPLIED;
    if (verdict === "conflict" && !force) {
      return { status: "conflict", server: current };
    }
    if (await isSyncedCalendar(supabase, change.data.calendarId)) {
      return { status: "rejected", reason: OFFLINE_MESSAGES.syncedRejected };
    }
    const data = {
      ...change.data,
      description: change.data.description ?? null,
    };
    const created = await createSingle(
      supabase,
      userId,
      toRow(data),
      change.id,
    );
    return created.ok ? APPLIED : failed(created.error);
  }

  const mine = change.type === "event.update" ? change.data : null;
  // Expelled from its calendar: not "deleted by another", just not allowed (RF-47).
  if (!server && !(await canSeeCalendar(supabase, change.base.calendarId))) {
    return failed(CALENDAR_MESSAGES.forbidden);
  }
  if (!force) {
    const verdict = verdictOrGone(
      fields(change.base),
      mine && fields(mine),
      current,
    );
    if (verdict === "applied") return APPLIED;
    if (verdict === "conflict") return { status: "conflict", server: current };
  }
  if (!server) {
    return mine ? failed(CALENDAR_MESSAGES.notFound) : APPLIED;
  }
  if (
    (await isSyncedCalendar(supabase, server.calendarId)) ||
    (mine && (await isSyncedCalendar(supabase, mine.calendarId)))
  ) {
    return { status: "rejected", reason: OFFLINE_MESSAGES.syncedRejected };
  }

  if (!mine) {
    const result = server.series
      ? await deleteOccurrences(supabase, server.series, "this", true)
      : await deleteSingle(supabase, server.id, "page");
    return result ? failed(result.formError) : APPLIED;
  }

  // A partial event did not know the description: it keeps the server's (R6).
  const data: EventData = {
    ...mine,
    description:
      mine.description === undefined ? server.description : mine.description,
  };
  const values = seriesValues(server, data, timeZone);
  const saved = server.series
    ? await changeOccurrence(
        supabase,
        { ...server, series: server.series },
        { data, values, scope: "this", confirmLoss: true, timeZone },
      )
    : await updateSingle(supabase, server, data, values);
  if (typeof saved === "string") return failed(CALENDAR_MESSAGES.notFound);
  if ("id" in saved) return APPLIED;
  const field = Object.values(saved.fieldErrors ?? {}).find(Boolean);
  return failed(saved.formError ?? field);
}

function noteFields(note: Note): Fields {
  return {
    title: note.title,
    body: note.body,
    color: note.color,
    pinned: note.pinned,
    archived: note.archived,
    dueDate: note.dueDate,
  };
}

function noteRow({ dueDate, ...rest }: NoteFields) {
  return { ...rest, ...(dueDate !== undefined ? { due_date: dueDate } : {}) };
}

async function itemNow(supabase: Supabase, id: string) {
  const { data, error } = await supabase
    .from("note_items")
    .select("text, done")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** One write of notes: an error in the user's words, or "gone" for 0 rows. */
async function noteWrite(
  write: PromiseLike<{
    data: unknown[] | null;
    error: { code?: string; message?: string } | null;
  }>,
): Promise<ApplyResult> {
  const { data, error } = await write;
  if (error) return failed(getNoteErrorMessage(error));
  return data && data.length > 0 ? APPLIED : failed(NOTE_MESSAGES.gone);
}

type NoteChange = Extract<
  ParsedChange,
  { type: `note.${string}` | `item.${string}` }
>;

async function applyNote(
  supabase: Supabase,
  change: NoteChange,
  force: boolean,
): Promise<ApplyResult> {
  switch (change.type) {
    case "note.create": {
      if (await getNote(supabase, change.id)) return APPLIED;
      const { title, ...rest } = change.fields;
      const inserted = await noteWrite(
        supabase
          .from("notes")
          .insert({
            id: change.id,
            kind: change.kind,
            title: title ?? "",
            calendar_id: change.calendarId,
          })
          .select("id"),
      );
      if (inserted.status !== "applied" || Object.keys(rest).length === 0) {
        return inserted;
      }
      return noteWrite(
        supabase
          .from("notes")
          .update(noteRow(rest))
          .eq("id", change.id)
          .select("id"),
      );
    }
    case "note.update":
    case "note.delete": {
      const note = await getNote(supabase, change.id);
      const current = note ? noteFields(note) : null;
      const mine =
        change.type === "note.update"
          ? { ...change.base, ...change.fields }
          : null;
      if (!force) {
        const verdict = verdictOrGone(change.base, mine, current);
        if (verdict === "applied") return APPLIED;
        if (verdict === "conflict")
          return { status: "conflict", server: current };
      }
      if (!note) return mine ? failed(NOTE_MESSAGES.gone) : APPLIED;
      return change.type === "note.update"
        ? noteWrite(
            supabase
              .from("notes")
              .update(noteRow(change.fields))
              .eq("id", change.id)
              .select("id"),
          )
        : noteWrite(
            supabase.from("notes").delete().eq("id", change.id).select("id"),
          );
    }
    case "item.add": {
      if (await itemNow(supabase, change.id)) return APPLIED;
      const { error } = await supabase.from("note_items").insert({
        id: change.id,
        note_id: change.noteId,
        text: change.text,
        position: change.position,
        done: change.done,
      });
      if (!error) return APPLIED;
      return failed(
        error.code === "42501"
          ? NOTE_MESSAGES.gone
          : getNoteErrorMessage(error),
      );
    }
    case "item.update":
    case "item.delete": {
      const current = await itemNow(supabase, change.id);
      const mine =
        change.type === "item.update"
          ? { ...change.base, ...change.change }
          : null;
      if (!force) {
        const verdict = verdictOrGone(change.base, mine, current);
        if (verdict === "applied") return APPLIED;
        if (verdict === "conflict")
          return { status: "conflict", server: current };
      }
      if (!current) return mine ? failed(NOTE_MESSAGES.gone) : APPLIED;
      return change.type === "item.update"
        ? noteWrite(
            supabase
              .from("note_items")
              .update(change.change)
              .eq("id", change.id)
              .select("id"),
          )
        : noteWrite(
            supabase
              .from("note_items")
              .delete()
              .eq("id", change.id)
              .select("id"),
          );
    }
    case "item.move": {
      // The order never asks (decision of the user, plan): it goes over the
      // current one, and items that are gone are left out.
      const results = await Promise.all(
        change.positions.map(({ id, position }) =>
          supabase
            .from("note_items")
            .update({ position })
            .eq("id", id)
            .eq("note_id", change.noteId),
        ),
      );
      const error = results.find((result) => result.error)?.error;
      return error ? failed(getNoteErrorMessage(error)) : APPLIED;
    }
  }
}

/** One change of the queue, in the user's session (plan "Contratos"). */
export async function applyChange(
  supabase: Supabase,
  userId: string,
  timeZone: string,
  change: ParsedChange,
  force = false,
): Promise<ApplyResult> {
  try {
    if (change.type.startsWith("event.")) {
      return await applyEvent(
        supabase,
        userId,
        timeZone,
        change as EventChange,
        force,
      );
    }
    if (change.type.startsWith("note.") || change.type.startsWith("item.")) {
      return await applyNote(supabase, change as NoteChange, force);
    }
    // Series, comments and images arrive in spec 035 T6 and T7.
    return failed(OFFLINE_MESSAGES.needsNetwork);
  } catch {
    // The network or Supabase failed: keep it for later (RF-46).
    return { status: "retry" };
  }
}
