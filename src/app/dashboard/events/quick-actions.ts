"use server";

import { z } from "zod";
import { placeAt } from "@/lib/calendar/drag";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";
import {
  getCalendar,
  getEvent,
  getProfileTimeZone,
  requireActionUser,
} from "@/lib/calendar/queries";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { UNDO_ERRORS, type Change, type UndoToken } from "@/lib/calendar/undo";
import { changeSchema, undoTokenSchema } from "@/lib/calendar/undo-schemas";
import type { ConfirmState } from "@/lib/forms/form-state";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import type { SeriesScope } from "@/lib/recurrence/series-write";
import { isGoneDone, providerOrGoogle } from "@/lib/sync/provider-labels";
import {
  canWriteEvents,
  readOnlyPasteText,
  readOnlyReason,
} from "@/lib/sync/read-only";
import type { EventRowInput } from "@/lib/sync/write-event";
import { goneText, writeErrorText } from "@/lib/sync/write-errors";
import {
  createSingle,
  deleteOccurrences,
  deleteSingle,
  dropTrash,
  isSyncedCalendar,
  refresh,
  snapshotForTrash,
  syncedWrite,
  toRow,
} from "./event-writes";
import {
  applyChange,
  NOT_FOUND,
  readScope,
  updatedAtOf,
  type QuickResult,
  type ScopeOptions,
} from "./quick-writes";

// Changes made without the form: dragging, the context menu and the keyboard
// (spec 017 plan quick-actions, D5). Only actions here: the helpers live in
// quick-writes.ts so they never become endpoints.

const errorOf = (error: unknown): QuickResult => ({
  ok: false,
  error: getCalendarErrorMessage(error),
});

/** Moves, resizes or recolors an event (RF-18, RF-36 to RF-38). */
export async function quickChange(
  id: string,
  change: Change,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  const parsed = changeSchema.safeParse(change);
  if (!parseEventId(id) || !parsed.success) return NOT_FOUND;
  const { supabase, userId } = await requireActionUser();
  try {
    // The zone comes from the profile, never from the client (spec 002 RF-34).
    const timeZone = await getProfileTimeZone(supabase, userId);
    const event = await getEvent(supabase, id);
    if (!event) return NOT_FOUND;
    return await applyChange(supabase, event, parsed.data, {
      ...options,
      timeZone,
    });
  } catch (error) {
    return errorOf(error);
  }
}

/**
 * Deletes without asking, after keeping a copy in the trash (RF-25, RF-31,
 * plan D6, D17; spec 046 RF-1, RF-2). An occurrence goes through its scope and
 * the loss warning of spec 013; every scope can be undone (spec 046 RF-15).
 */
export async function deleteForUndo(
  id: string,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  if (!parseEventId(id)) return NOT_FOUND;
  const { supabase } = await requireActionUser();
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
    return { ok: true, id, undo: { kind: "restore", trashId, guard } };
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

function restoreFailure(error: unknown): { ok: false; error: string } {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return {
    ok: false,
    error: RESTORE_ERRORS[code] ?? getCalendarErrorMessage(error),
  };
}

type UndoResult = { ok: true } | { ok: false; error: string };

/** Undoes the last quick action within its 10 s (RF-27 to RF-30). */
export async function undoAction(token: UndoToken): Promise<UndoResult> {
  const parsed = undoTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: UNDO_ERRORS.expired };
  const undo = parsed.data;
  const { supabase, userId } = await requireActionUser();
  try {
    if (undo.kind === "unpaste") {
      const failed = await deleteSingle(supabase, undo.id, "modal");
      if (failed && failed.done !== "gone") {
        return { ok: false, error: failed.formError ?? UNDO_ERRORS.expired };
      }
      refresh();
      return { ok: true };
    }

    if (undo.kind === "change") {
      // Someone else changed it meanwhile: theirs wins (RF-29, plan D8).
      const event = await getEvent(supabase, undo.id);
      if (!event || (await updatedAtOf(supabase, undo.id)) !== undo.updatedAt) {
        return { ok: false, error: UNDO_ERRORS.changed };
      }
      const timeZone = await getProfileTimeZone(supabase, userId);
      const result = await applyChange(supabase, event, undo.before, {
        scope: undo.series ? "this" : undefined,
        timeZone,
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }

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
    } else {
      const { error } = await supabase.rpc("restore_event", {
        p_trash_id: undo.trashId,
      });
      if (error) return restoreFailure(error);
    }
    refresh();
    return { ok: true };
  } catch (error) {
    return restoreFailure(error);
  }
}

const pasteTargetSchema = z.object({
  day: z.string().refine((day) => parseDateKey(day) !== null),
  minute: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 - 15)
    .optional(),
});

/**
 * A copy of the event on the day or slot chosen, with its duration and
 * calendar but no images nor comments (RF-58 to RF-61). An occurrence is
 * pasted as a single event, as duplicating it (spec 013).
 */
export async function pasteEvent(
  sourceId: string,
  target: { day: string; minute?: number },
): Promise<QuickResult> {
  const place = pasteTargetSchema.safeParse(target);
  if (!parseEventId(sourceId) || !place.success) return NOT_FOUND;
  const { supabase, userId } = await requireActionUser();
  try {
    const event = await getEvent(supabase, sourceId);
    if (!event) return NOT_FOUND;
    const calendar = await getCalendar(supabase, userId, event.calendarId);
    if (!calendar || !canWriteEvents(calendar)) {
      const reason = calendar ? readOnlyReason(calendar.synced) : null;
      return {
        ok: false,
        error:
          reason && calendar?.synced
            ? readOnlyPasteText(
                reason,
                providerOrGoogle(calendar.synced.provider),
              )
            : CALENDAR_MESSAGES.forbidden,
      };
    }
    const timeZone = await getProfileTimeZone(supabase, userId);
    const times = placeAt(event, place.data.day, place.data.minute, timeZone);
    const row = toRow({
      title: event.title,
      calendarId: event.calendarId,
      description: event.description,
      location: event.location,
      color: event.color,
      categoryId: event.categoryId,
      ...times,
      // The pasted copy keeps the zone (spec 045 RF-11).
      ...(times.allDay
        ? {}
        : {
            startTz: event.startTz ?? event.series?.recurrenceTz ?? null,
            endTz: event.endTz,
          }),
    });

    const created = await createSingle(supabase, userId, row);
    if (!created.ok) return created;
    refresh();
    return {
      ok: true,
      id: created.id,
      undo: { kind: "unpaste", id: created.id },
    };
  } catch (error) {
    return errorOf(error);
  }
}

/**
 * "Borrar evento" of the detail: no confirmation, and the undo token for the
 * notice (RF-25, RF-31). An occurrence sends its scope and the loss
 * confirmation from SeriesScopeDialog, as the form of spec 013 did.
 */
export async function deleteFromDetail(
  id: string,
  _prevState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const scope = formData.get("scope");
  const result = await deleteForUndo(id, {
    scope: typeof scope === "string" ? (scope as SeriesScope) : undefined,
    confirmLoss: formData.get("confirmLoss") === "1",
  });
  if (result.ok) return { done: "deleted", undo: result.undo };
  if (result.gone) return { done: result.gone };
  if (result.loss) return { loss: result.loss };
  return { formError: result.error };
}
