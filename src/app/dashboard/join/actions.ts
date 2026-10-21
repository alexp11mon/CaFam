"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { JoinCodeState } from "@/components/sharing/join-code-form";
import { requireActionUser } from "@/lib/calendar/queries";
import { fieldErrorsFromZod, readString } from "@/lib/forms/form-state";
import {
  getJoinStatusMessage,
  getSharingErrorMessage,
} from "@/lib/sharing/error-messages";
import { joinCodeSchema, type JoinCodeField } from "@/lib/sharing/schemas";

export async function joinWithCode(
  _prevState: JoinCodeState,
  formData: FormData,
): Promise<JoinCodeState> {
  const raw = {
    code: readString(formData, "code"),
    pin: readString(formData, "pin"),
  };
  // The PIN is never sent back to the form.
  const parsed = joinCodeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      fieldErrors: fieldErrorsFromZod<JoinCodeField>(parsed.error),
      values: { code: raw.code, pin: "" },
    };
  }
  const values = { code: parsed.data.code, pin: "" };

  const { supabase } = await requireActionUser();
  try {
    const { data, error } = await supabase.rpc("join_with_code", {
      p_code: parsed.data.code,
      p_pin: parsed.data.pin,
    });
    if (error) return { formError: getSharingErrorMessage(error), values };
    const status = data?.[0]?.status;
    // `member` means already inside: nothing changes, not even the role (RF-23).
    if (status !== "ok" && status !== "member") {
      return {
        formError: getJoinStatusMessage(
          status === "limited" ? "limited" : "invalid",
        ),
        values,
      };
    }
  } catch (error) {
    return { formError: getSharingErrorMessage(error), values };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/calendar");
}
