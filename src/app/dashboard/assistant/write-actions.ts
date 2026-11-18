"use server";

import {
  assistantUndoSchema,
  pendingChangeSchema,
} from "@/lib/assistant/schemas";
import { getCalendarErrorMessage } from "@/lib/calendar/error-messages";
import { getProfileTimeZone, requireActionUser } from "@/lib/calendar/queries";
import { UNDO_ERRORS } from "@/lib/calendar/undo";
import { refresh } from "../events/event-writes";
import {
  applyPendingChange,
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
