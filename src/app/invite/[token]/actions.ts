"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isInviteToken } from "@/lib/auth/next-path";
import { requireActionUser } from "@/lib/calendar/queries";
import type { ConfirmState } from "@/lib/forms/form-state";
import {
  getSharingErrorMessage,
  SHARING_MESSAGES,
} from "@/lib/sharing/error-messages";

// POST on purpose: opening the link only previews, so link scanners of
// messaging apps do not spend uses (plan D8).
export async function acceptInvite(token: string): Promise<ConfirmState> {
  if (!isInviteToken(token)) {
    return { formError: SHARING_MESSAGES.invalidInvite };
  }

  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase.rpc("accept_invite", { p_token: token });
    if (error) return { formError: getSharingErrorMessage(error) };
  } catch (error) {
    return { formError: getSharingErrorMessage(error) };
  }

  // Without this the client router cache would keep the old panel (plan D18).
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/calendar");
}
