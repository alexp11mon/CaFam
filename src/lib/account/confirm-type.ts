import { ACCOUNT_MESSAGES } from "./error-messages";

// Spec 006, T10: what each Auth link type verifies and where it lands (plan D8;
// RF-2, RF-3, RF-11, RF-12). `next` is never read, so a link cannot redirect elsewhere.

export interface ConfirmPlan {
  otpType: "recovery" | "email_change" | "signup" | "email";
  success: string;
  failure: string;
}

// Spec 049 RF-2: the signup link enters the calendar with a notice; a dead one
// offers a new link.
const SIGNUP: Omit<ConfirmPlan, "otpType"> = {
  success: "/dashboard/calendar?confirmed=1",
  failure: "/signup/check-email?expired=1",
};

const PLANS = new Map<string, ConfirmPlan>([
  ["signup", { otpType: "signup", ...SIGNUP }],
  ["email", { otpType: "email", ...SIGNUP }],
  [
    "recovery",
    {
      otpType: "recovery",
      success: "/reset-password",
      failure: "/forgot-password?expired=1",
    },
  ],
  [
    "email_change",
    {
      otpType: "email_change",
      success: "/dashboard/settings",
      failure: "/dashboard/settings?confirm=invalid",
    },
  ],
]);

/** The plan for a link type, or null for a type this app does not confirm. */
export function getConfirmPlan(type: string | null): ConfirmPlan | null {
  return type === null ? null : (PLANS.get(type) ?? null);
}

/** Message for Ajustes when an email change link failed (RF-12); null otherwise. */
export function getConfirmNotice(value: string | undefined): string | null {
  return value === "invalid" ? ACCOUNT_MESSAGES.invalidLink : null;
}
