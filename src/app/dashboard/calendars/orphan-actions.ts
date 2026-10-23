"use server";

import { revalidatePath } from "next/cache";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import type { ConfirmState } from "@/lib/forms/form-state";

const ORPHAN_GONE = "Este calendario ya no está disponible.";

/**
 * Keep (true) or leave (false) a calendar without owner (RF-24, RF-25). Bound
 * with the calendar and the choice; useActionState passes the rest, unused.
 */
export async function decideOrphanCalendar(
  calendarId: string,
  keep: boolean,
  _prevState: ConfirmState,
  _formData: FormData,
): Promise<ConfirmState> {
  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase.rpc("decide_orphan_calendar", {
      p_calendar_id: calendarId,
      p_keep: keep,
    });
    if (error) {
      // CF404: no longer without owner, or no longer a member (T5).
      return {
        formError:
          error.code === "CF404" ? ORPHAN_GONE : AUTH_MESSAGES.connection,
      };
    }
  } catch {
    return { formError: AUTH_MESSAGES.connection };
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

/** Closes a notice; RLS and the column privilege only allow read_at on own rows (RF-23). */
export async function dismissNotice(
  noticeId: string,
  _prevState: ConfirmState,
  _formData: FormData,
): Promise<ConfirmState> {
  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase
      .from("account_notices")
      .update({ read_at: new Date().toISOString() })
      .eq("id", noticeId);
    if (error) return { formError: AUTH_MESSAGES.connection };
  } catch {
    return { formError: AUTH_MESSAGES.connection };
  }
  revalidatePath("/dashboard", "layout");
  return {};
}
