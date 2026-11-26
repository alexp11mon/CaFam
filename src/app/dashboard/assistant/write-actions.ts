"use server";

import {
  assistantUndoSchema,
  pendingChangeSchema,
  pendingDeleteSchema,
  pendingSeriesSchema,
} from "@/lib/assistant/schemas";
import { getCalendarErrorMessage } from "@/lib/calendar/error-messages";
import { getProfileTimeZone, requireActionUser } from "@/lib/calendar/queries";
import { UNDO_ERRORS } from "@/lib/calendar/undo";
import { refresh } from "../events/event-writes";
import {
  applyPendingChange,
  applyPendingDelete,
  applyPendingSeries,
  CHANGE_TEXTS,
  undoWrite,
  type WriteResult,
} from "./change-writes";

// Spec 036: "Confirmar" and "Deshacer" of Venito's cards (plan
// "write-actions", D4). What they get comes from the browser: validated
// here, with the session and the profile's zone (spec 002 RF-34).

/** RF-24a: writes a change the user confirmed. */
export async function confirmChange(change: unknown): Promise<WriteResult> {
  const parsed = pendingChangeSchema.safeParse(change);
  if (!parsed.success) return { ok: false, error: CHANGE_TEXTS.invalid };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const result = await applyPendingChange(supabase, timeZone, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return { ok: false, error: getCalendarErrorMessage(error) };
  }
}

/** Spec 052 RF-3: deletes what a card showed, once the user said "Borrar". */
export async function confirmDelete(remove: unknown): Promise<WriteResult> {
  const parsed = pendingDeleteSchema.safeParse(remove);
  if (!parsed.success) return { ok: false, error: CHANGE_TEXTS.invalid };
  const { supabase } = await requireActionUser();
  try {
    const result = await applyPendingDelete(supabase, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return { ok: false, error: getCalendarErrorMessage(error) };
  }
}

/** Spec 052 RF-6: creates the series a card showed, once the user said "Crear". */
export async function confirmSeries(series: unknown): Promise<WriteResult> {
  const parsed = pendingSeriesSchema.safeParse(series);
  if (!parsed.success) return { ok: false, error: CHANGE_TEXTS.invalid };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const result = await applyPendingSeries(
      supabase,
      userId,
      timeZone,
      parsed.data,
    );
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return { ok: false, error: getCalendarErrorMessage(error) };
  }
}

/** RF-34 to RF-37: undoes a creation or a confirmed change. */
export async function undoAssistantAction(
  token: unknown,
): Promise<WriteResult> {
  const parsed = assistantUndoSchema.safeParse(token);
  if (!parsed.success) return { ok: false, error: UNDO_ERRORS.expired };
  const { supabase, userId } = await requireActionUser();
  try {
    const timeZone = await getProfileTimeZone(supabase, userId);
    const result = await undoWrite(supabase, timeZone, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    return { ok: false, error: getCalendarErrorMessage(error) };
  }
}
