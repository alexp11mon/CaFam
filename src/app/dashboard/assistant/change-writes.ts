import type {
  AssistantUndo,
  ChangeFields,
  PendingChange,
} from "@/lib/assistant/actions";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { getEvent, type EventRecord } from "@/lib/calendar/queries";
import { UNDO_ERRORS } from "@/lib/calendar/undo";
import { isGoneDone } from "@/lib/sync/provider-labels";
import { goneText } from "@/lib/sync/write-errors";
import {
  changeOccurrence,
  deleteSingle,
  updateSingle,
  type Supabase,
} from "../events/event-writes";
import { fromState, seriesValues, updatedAtOf } from "../events/quick-writes";
import { undoNote } from "./note-writes";

// Spec 036: what "Confirmar" and "Deshacer" write (plan "write-actions", D4,
// D7, D8). Not a "use server" file: the actions in write-actions.ts check the
// session and the input, and RLS decides again here.

export type WriteResult =
  { ok: true; undo?: AssistantUndo } | { ok: false; error: string };

export const CHANGE_TEXTS = {
  changed:
    "Este evento ha cambiado desde que te propuse el cambio; no lo he aplicado. Pídemelo otra vez.",
  invalid: "Este cambio ya no es válido. Pídemelo otra vez.",
} as const;

/** The row whose updated_at guards an event: its own, or its series' (D7). */
const guardId = (event: EventRecord) =>
  event.rowId ?? event.series?.id ?? event.id;

const fieldsOf = (event: EventRecord): ChangeFields => ({
  title: event.title,
  description: event.description,
  location: event.location,
  calendarId: event.calendarId,
  startsAt: event.startsAt,
  endsAt: event.endsAt,
  allDay: event.allDay,
});

/** Writes `fields` to the event with the form's writes (Google first, scopes). */
async function write(
  supabase: Supabase,
  timeZone: string,
  event: EventRecord,
  fields: ChangeFields,
  scope: PendingChange["scope"],
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const data = {
    ...fields,
    color: event.color,
    // A category belongs to its calendar (spec 002 RF-28).
    categoryId:
      fields.calendarId === event.calendarId ? event.categoryId : null,
  };
  const values = seriesValues(event, data, timeZone);
  const saved = event.series
    ? await changeOccurrence(
        supabase,
        { ...event, series: event.series },
        // RF-30: the card showed what would be lost (D9).
        { data, values, scope: scope ?? "this", confirmLoss: true, timeZone },
      )
    : await updateSingle(supabase, event, data, values);
  if (isGoneDone(saved)) return { ok: false, error: goneText(saved) };
  if (!("id" in saved)) {
    const failed = fromState(saved);
    return { ok: false, error: failed.ok ? "" : failed.error };
  }
  return { ok: true, id: saved.id };
}

/** RF-24a, RF-24d: applies a confirmed change if the event is still as shown. */
export async function applyPendingChange(
  supabase: Supabase,
  timeZone: string,
  change: PendingChange,
): Promise<WriteResult> {
  const event = await getEvent(supabase, change.id);
  if (!event) return { ok: false, error: CALENDAR_MESSAGES.notFound };
  if ((await updatedAtOf(supabase, guardId(event))) !== change.updatedAt) {
    return { ok: false, error: CHANGE_TEXTS.changed };
  }
  const written = await write(
    supabase,
    timeZone,
    event,
    change.fields,
    change.scope,
  );
  if (!written.ok) return written;
  // Plan D8: a change to several occurrences cannot go back to "before".
  if (event.series && change.scope !== "this") return { ok: true };
  return {
    ok: true,
    undo: {
      kind: "unchange",
      id: written.id,
      updatedAt: await updatedAtOf(supabase, written.id),
      before: fieldsOf(event),
      series: Boolean(event.series),
    },
  };
}

/** RF-34 to RF-36: undoes what Venito did, unless someone changed it since. */
export async function undoWrite(
  supabase: Supabase,
  timeZone: string,
  undo: AssistantUndo,
): Promise<WriteResult> {
  if (undo.kind === "unnote") return undoNote(supabase, undo);
  const event = await getEvent(supabase, undo.id);
  if (!event) return { ok: false, error: UNDO_ERRORS.changed };
  if ((await updatedAtOf(supabase, guardId(event))) !== undo.updatedAt) {
    return { ok: false, error: UNDO_ERRORS.changed };
  }
  if (undo.kind === "uncreate") {
    const failed = await deleteSingle(supabase, undo.id, "modal");
    // Already deleted in the provider: it is gone either way.
    if (failed && !isGoneDone(failed.done)) {
      return { ok: false, error: failed.formError ?? UNDO_ERRORS.expired };
    }
    return { ok: true };
  }
  const written = await write(
    supabase,
    timeZone,
    event,
    undo.before,
    undo.series ? "this" : null,
  );
  return written.ok ? { ok: true } : written;
}
