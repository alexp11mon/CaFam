import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import { getEvent, type EventRecord } from "@/lib/calendar/queries";
import type { EventData, EventFormValues } from "@/lib/calendar/schemas";
import { utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";
import { UNDO_ERRORS, type Change, type UndoToken } from "@/lib/calendar/undo";
import type { Loss } from "@/lib/forms/form-state";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { SERIES_SCOPES, type SeriesScope } from "@/lib/recurrence/series-write";
import { isGoneDone, type GoneDone } from "@/lib/sync/provider-labels";
import type { EventRowInput } from "@/lib/sync/write-event";
import { goneText, writeErrorText } from "@/lib/sync/write-errors";
import {
  changeOccurrence,
  deleteOccurrences,
  deleteSingle,
  dropTrash,
  isSyncedCalendar,
  refresh,
  snapshotForTrash,
  syncedWrite,
  updateSingle,
  type EventFormState,
  type Supabase,
} from "./event-writes";

// Shared by the quick actions (spec 017 plan quick-actions, D5): they reuse
// the form's writes (Google first, series scopes) and answer a result
// instead of redirecting.

export type QuickResult =
  | { ok: true; id: string; undo?: UndoToken }
  | { ok: false; error: string; gone?: GoneDone; loss?: Loss };

export interface ScopeOptions {
  scope?: SeriesScope;
  confirmLoss?: boolean;
}

export const errorOf = (error: unknown): QuickResult => ({
  ok: false,
  error: getCalendarErrorMessage(error),
});

export const NOT_FOUND: QuickResult = {
  ok: false,
  error: CALENDAR_MESSAGES.notFound,
};

export function readScope(options: ScopeOptions): SeriesScope | null {
  return options.scope && SERIES_SCOPES.includes(options.scope)
    ? options.scope
    : null;
}

/** The event with only the change applied: everything else stays (RF-18). */
function withChange(event: EventRecord, change: Change): EventData {
  return {
    title: event.title,
    calendarId: event.calendarId,
    description: event.description,
    location: event.location,
    categoryId: event.categoryId,
    color: change.kind === "color" ? change.color : event.color,
    startsAt: change.kind === "times" ? change.startsAt : event.startsAt,
    endsAt: change.kind === "times" ? change.endsAt : event.endsAt,
    allDay: change.kind === "times" ? change.allDay : event.allDay,
  };
}

/** What planSeriesChange reads from the form: the same rule, the new date. */
export function seriesValues(
  event: Pick<EventRecord, "series">,
  data: EventData,
  timeZone: string,
): EventFormValues {
  return {
    title: data.title,
    calendarId: data.calendarId,
    allDay: data.allDay ? "on" : "",
    startDate: data.allDay
      ? utcDateKey(data.startsAt)
      : zonedDateKey(data.startsAt, timeZone),
    startTime: "",
    endDate: "",
    endTime: "",
    description: data.description ?? "",
    location: data.location ?? "",
    color: data.color ?? "",
    categoryId: data.categoryId ?? "",
    repeat: event.series ? `custom:${event.series.recurrence}` : "none",
    startTz: "",
    endTz: "",
  };
}

function before(event: EventRecord, change: Change): Change {
  return change.kind === "color"
    ? { kind: "color", color: event.color }
    : {
        kind: "times",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        allDay: event.allDay,
      };
}

/** A form state as a quick result: its first message, or the loss to confirm. */
export function fromState(state: EventFormState): QuickResult {
  if (state.loss) return { ok: false, error: "", loss: state.loss };
  const field = Object.values(state.fieldErrors ?? {}).find(Boolean);
  return {
    ok: false,
    error: state.formError ?? field ?? CALENDAR_MESSAGES.notFound,
  };
}

export async function updatedAtOf(
  supabase: Supabase,
  id: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("events")
    .select("updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.updated_at ?? "";
}

/** Writes a change to an event already read; shared with undoAction. */
export async function applyChange(
  supabase: Supabase,
  event: EventRecord,
  change: Change,
  options: ScopeOptions & { timeZone: string },
): Promise<QuickResult> {
  const data = withChange(event, change);
  const values = seriesValues(event, data, options.timeZone);
  const scope = readScope(options);
  const saved = event.series
    ? await changeOccurrence(
        supabase,
        { ...event, series: event.series },
        {
          data,
          values,
          scope,
          confirmLoss: Boolean(options.confirmLoss),
          timeZone: options.timeZone,
        },
      )
    : await updateSingle(supabase, event, data, values);

  if (isGoneDone(saved)) {
    refresh();
    return { ok: false, gone: saved, error: goneText(saved) };
  }
  if (!("id" in saved)) return fromState(saved);
  refresh();
  // Undoing a cut or the whole series is not "the values of before" (plan D10).
  if (event.series && scope !== "this") return { ok: true, id: saved.id };
  return {
    ok: true,
    id: saved.id,
    undo: {
      kind: "change",
      id: saved.id,
      before: before(event, change),
      updatedAt: await updatedAtOf(supabase, saved.id),
      series: Boolean(event.series),
    },
  };
}

/**
 * Deletes without asking, after keeping a copy in the trash (RF-25, RF-31,
 * plan D6, D17; spec 046 RF-1, RF-2). An occurrence goes through its scope and
 * the loss warning of spec 013; every scope can be undone (spec 046 RF-15).
 */
export async function deleteWithTrash(
  supabase: Supabase,
  id: string,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  if (!parseEventId(id)) return NOT_FOUND;
  try {
    const event = await getEvent(supabase, id);
    if (!event) return NOT_FOUND;
    const scope = readScope(options);
    const trashId = await snapshotForTrash(supabase, event, scope ?? null);

    const failed = event.series
      ? await deleteOccurrences(
          supabase,
          event.series,
          scope,
          Boolean(options.confirmLoss),
        )
      : await deleteSingle(supabase, id, "modal");
    if (failed) await dropTrash(supabase, trashId);
    if (failed?.loss) return { ok: false, error: "", loss: failed.loss };
    if (isGoneDone(failed?.done)) {
      return { ok: false, gone: failed.done, error: goneText(failed.done) };
    }
    if (failed) {
      return {
        ok: false,
        error: failed.formError ?? CALENDAR_MESSAGES.notFound,
      };
    }

    refresh();
    if (!trashId) return { ok: true, id };
    // Several occurrences: undoing must not step on later changes (RF-15).
    const guard =
      event.series && scope !== "this"
        ? {
            id: event.series.id,
            updatedAt: await updatedAtOf(supabase, event.series.id),
          }
        : undefined;
    const again = event.series && scope ? { id, scope } : undefined;
    return { ok: true, id, undo: { kind: "restore", trashId, guard, again } };
  } catch (error) {
    return errorOf(error);
  }
}

const RESTORE_ERRORS: Record<string, string> = {
  CF404: UNDO_ERRORS.expired,
  CF410: UNDO_ERRORS.seriesGone,
  "23505": UNDO_ERRORS.changed,
  "23503": UNDO_ERRORS.changed,
};

export function restoreFailure(error: unknown): { ok: false; error: string } {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return {
    ok: false,
    error: RESTORE_ERRORS[code] ?? getCalendarErrorMessage(error),
  };
}

/** The type undoAction answers: `inverse` redoes it (spec 046 RF-12). */
export type UndoResult =
  { ok: true; inverse?: UndoToken } | { ok: false; error: string };

/**
 * Brings back a deletion from the trash, through Google or iCloud first for
 * a synced calendar (spec 046 RF-3, RF-14, RF-15). Shared by "Deshacer" of
 * the calendar and of Venito (spec 052 RF-3).
 */
export async function restoreTrash(
  supabase: Supabase,
  undo: Extract<UndoToken, { kind: "restore" }>,
): Promise<UndoResult> {
  try {
    if (
      undo.guard &&
      (await updatedAtOf(supabase, undo.guard.id)) !== undo.guard.updatedAt
    ) {
      return { ok: false, error: UNDO_ERRORS.changed };
    }
    const { data: row, error: rowError } = await supabase.rpc("trash_row", {
      p_trash_id: undo.trashId,
    });
    if (rowError) return restoreFailure(rowError);
    const saved = row as EventRowInput | null;
    let restored: string | null = null;
    if (saved && (await isSyncedCalendar(supabase, saved.calendar_id))) {
      // Google gets it back first, as a new event (RF-3, case of synced calendars).
      const created = await syncedWrite(supabase, {
        op: "create",
        row: {
          calendar_id: saved.calendar_id,
          title: saved.title,
          description: saved.description,
          location: saved.location,
          starts_at: saved.starts_at,
          ends_at: saved.ends_at,
          all_day: saved.all_day,
          color: saved.color,
          category_id: saved.category_id,
        },
      });
      if (created.status === "failed") {
        return {
          ok: false,
          error: writeErrorText(created.failure, created.provider),
        };
      }
      if (created.status !== "done") return restoreFailure(null);
      const { error } = await supabase.rpc("restore_event", {
        p_trash_id: undo.trashId,
        p_event_id: created.eventId,
      });
      if (error) return restoreFailure(error);
      restored = created.eventId;
    } else {
      const { data, error } = await supabase.rpc("restore_event", {
        p_trash_id: undo.trashId,
      });
      if (error) return restoreFailure(error);
      restored = data;
    }
    refresh();
    const again = undo.again ?? (restored ? { id: restored } : null);
    return again
      ? { ok: true, inverse: { kind: "delete", ...again } }
      : { ok: true };
  } catch (error) {
    return restoreFailure(error);
  }
}
