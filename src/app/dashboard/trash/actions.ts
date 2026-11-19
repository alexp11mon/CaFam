"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { undoAction } from "@/app/dashboard/events/quick-actions";
import { getCalendarErrorMessage } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import { TRASH_ERRORS } from "@/lib/calendar/trash";
import { UNDO_ERRORS } from "@/lib/calendar/undo";
import type { ConfirmState } from "@/lib/forms/form-state";

// The trash screen (spec 046 RF-5, RF-6). The database checks the role.

const idSchema = z.uuid();

/**
 * "Restaurar": the same path as "Deshacer" (spec 017), so a synced calendar
 * gets it back in Google or iCloud first (RF-5).
 */
export async function restoreFromTrash(
  trashId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!idSchema.safeParse(trashId).success) {
    return { ok: false, error: TRASH_ERRORS.gone };
  }
  const result = await undoAction({ kind: "restore", trashId });
  revalidatePath("/dashboard", "layout");
  if (result.ok) return { ok: true };
  return {
    ok: false,
    error:
      result.error === UNDO_ERRORS.expired ? TRASH_ERRORS.gone : result.error,
  };
}

function failure(error: unknown): ConfirmState {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return {
    formError:
      code === "CF404" ? TRASH_ERRORS.gone : getCalendarErrorMessage(error),
  };
}

/** "Borrar para siempre": no undo (RF-6). */
export async function purgeFromTrash(trashId: string): Promise<ConfirmState> {
  if (!idSchema.safeParse(trashId).success) {
    return { formError: TRASH_ERRORS.gone };
  }
  const { supabase } = await requireActionUser();
  const { error } = await supabase.rpc("trash_purge", { p_trash_id: trashId });
  if (error) return failure(error);
  revalidatePath("/dashboard/trash");
  return { done: "deleted" };
}

/** "Vaciar la papelera" of a calendar: only its owner (RF-6). */
export async function emptyTrash(calendarId: string): Promise<ConfirmState> {
  if (!idSchema.safeParse(calendarId).success) {
    return { formError: TRASH_ERRORS.gone };
  }
  const { supabase } = await requireActionUser();
  const { error } = await supabase.rpc("trash_empty", {
    p_calendar_id: calendarId,
  });
  if (error) return failure(error);
  revalidatePath("/dashboard/trash");
  return { done: "deleted" };
}
