"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";
import { requireActionUser } from "@/lib/calendar/queries";
import {
  fieldErrorsFromZod,
  readString,
  type ConfirmState,
} from "@/lib/forms/form-state";
import { getSharingErrorMessage } from "@/lib/sharing/error-messages";
import { buildInviteUrl } from "@/lib/sharing/invite-url";
import { inviteSchema, type InviteField } from "@/lib/sharing/schemas";
import type { InviteState } from "@/components/sharing/invite-form";

function refresh() {
  // Drop the client router cache so the list shows the change.
  revalidatePath("/dashboard", "layout");
}

export async function createInvite(
  calendarId: string,
  _prevState: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const values = {
    role: readString(formData, "role"),
    maxUses: readString(formData, "maxUses"),
  };
  const parsed = inviteSchema.safeParse(values);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFromZod<InviteField>(parsed.error),
      values,
    };
  }
  if (!z.uuid().safeParse(calendarId).success) {
    return { formError: CALENDAR_MESSAGES.notFound, values };
  }

  const { supabase } = await requireActionUser();
  let token: string;
  try {
    const { data, error } = await supabase.rpc("create_invite", {
      p_calendar_id: calendarId,
      p_role: parsed.data.role,
      p_max_uses: parsed.data.maxUses,
    });
    if (error || !data) {
      return { formError: getSharingErrorMessage(error), values };
    }
    token = data;
  } catch (error) {
    return { formError: getSharingErrorMessage(error), values };
  }

  refresh();
  // The link goes back in the action state only: the token is not stored anywhere (RF-1).
  return { values, inviteUrl: buildInviteUrl(await headers(), token) };
}

// The state argument useActionState passes is not needed: nothing to carry over.
export async function revokeInvite(inviteId: string): Promise<ConfirmState> {
  if (!z.uuid().safeParse(inviteId).success) {
    return { formError: CALENDAR_MESSAGES.notFound };
  }

  const { supabase } = await requireActionUser();
  try {
    const { error } = await supabase.rpc("revoke_invite", {
      p_invite_id: inviteId,
    });
    if (error) return { formError: getSharingErrorMessage(error) };
  } catch (error) {
    return { formError: getSharingErrorMessage(error) };
  }

  refresh();
  return {};
}
