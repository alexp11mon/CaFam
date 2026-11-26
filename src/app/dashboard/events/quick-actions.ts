"use server";

import { z } from "zod";
import { placeAt } from "@/lib/calendar/drag";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
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
import { providerOrGoogle } from "@/lib/sync/provider-labels";
import {
  canWriteEvents,
  readOnlyPasteText,
  readOnlyReason,
} from "@/lib/sync/read-only";
import { createSingle, refresh, toRow } from "./event-writes";
import {
  applyChange,
  deleteWithTrash,
  errorOf,
  NOT_FOUND,
  restoreFailure,
  restoreTrash,
  updatedAtOf,
  type QuickResult,
  type ScopeOptions,
  type UndoResult,
} from "./quick-writes";

// Changes made without the form: dragging, the context menu and the keyboard
// (spec 017 plan quick-actions, D5). Only actions here: the helpers live in
// quick-writes.ts so they never become endpoints.

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
 * plan D6, D17; spec 046 RF-1, RF-2). The core lives in quick-writes.ts so
 * Venito's "Borrar" reuses it with its own session (spec 052 RF-3).
 */
export async function deleteForUndo(
  id: string,
  options: ScopeOptions = {},
): Promise<QuickResult> {
  if (!parseEventId(id)) return NOT_FOUND;
  const { supabase } = await requireActionUser();
  return deleteWithTrash(supabase, id, options);
}

/**
 * Undoes an action of the stack, and redoes one with the inverse it gave
 * (spec 017 RF-27 to RF-30; spec 046 RF-11 to RF-15).
 */
export async function undoAction(token: UndoToken): Promise<UndoResult> {
  const parsed = undoTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: UNDO_ERRORS.expired };
  const undo = parsed.data;
  const { supabase, userId } = await requireActionUser();
  try {
    if (undo.kind === "unpaste" || undo.kind === "delete") {
      // Through the trash, so it can be redone (spec 046 RF-12).
      const result = await deleteForUndo(undo.id, {
        scope: undo.kind === "delete" ? undo.scope : undefined,
        confirmLoss: true,
      });
      if (result.ok) return { ok: true, inverse: result.undo };
      // Already gone: nothing left to undo.
      return result.gone ? { ok: true } : { ok: false, error: result.error };
    }

    if (undo.kind === "change") {
      // Someone else changed it meanwhile: theirs wins (RF-29, plan D8).
      const event = await getEvent(supabase, undo.id);
      if (!event || (await updatedAtOf(supabase, undo.id)) !== undo.updatedAt) {
        return { ok: false, error: UNDO_ERRORS.changed };
      }
      const after: Change =
        undo.before.kind === "times"
          ? {
              kind: "times",
              startsAt: event.startsAt,
              endsAt: event.endsAt,
              allDay: event.allDay,
            }
          : { kind: "color", color: event.color };
      const timeZone = await getProfileTimeZone(supabase, userId);
      const result = await applyChange(supabase, event, undo.before, {
        scope: undo.series ? "this" : undefined,
        timeZone,
      });
      if (!result.ok) return { ok: false, error: result.error };
      const id = result.id;
      return {
        ok: true,
        inverse: {
          kind: "change",
          id,
          before: after,
          updatedAt: await updatedAtOf(supabase, id),
          series: undo.series,
        },
      };
    }

    return await restoreTrash(supabase, undo);
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
