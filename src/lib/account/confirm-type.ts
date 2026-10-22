// Spec 006, T10: what each Auth link type verifies and where it lands (plan D8;
// RF-2, RF-3, RF-11, RF-12). `next` is never read, so a link cannot redirect elsewhere.

export interface ConfirmPlan {
  otpType: "recovery" | "email_change";
  success: string;
  failure: string;
}

const PLANS = new Map<string, ConfirmPlan>([
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
