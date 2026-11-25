"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCalendarErrorMessage } from "@/lib/calendar/error-messages";
import { getCalendar, requireActionUser } from "@/lib/calendar/queries";
import type { ConfirmState } from "@/lib/forms/form-state";
import { readString } from "@/lib/forms/form-state";
import { TRANSFER_TEXTS } from "@/lib/sharing/transfer-texts";

// Spec 049, T3: the owner gives a calendar to another member (RF-7 to RF-11).
// The database checks again who may and revokes the ways in (T1).
export async function transferCalendar(
  calendarId: string,
  _prevState: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const newOwner = z.uuid().safeParse(readString(formData, "newOwner"));
  if (!newOwner.success) return { formError: TRANSFER_TEXTS.member };
  let error: unknown;
  try {
    const { supabase, userId } = await requireActionUser();
    const calendar = await getCalendar(supabase, userId, calendarId);
    // Asked by name so it is never given away by mistake (spec "Riesgos").
    if (
      !calendar ||
      readString(formData, "confirmName").trim() !== calendar.name.trim()
    ) {
      return { formError: TRANSFER_TEXTS.name };
    }
    ({ error } = await supabase.rpc("transfer_calendar", {
      p_calendar_id: calendarId,
      p_new_owner: newOwner.data,
    }));
  } catch (caught) {
    error = caught;
  }
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "CF409") return { formError: TRANSFER_TEXTS.synced };
    if (code === "22023") return { formError: TRANSFER_TEXTS.member };
    return { formError: getCalendarErrorMessage(error) };
  }
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/calendars");
}
