import type { FormState } from "@/lib/forms/form-state";

// Results of the recovery Server Actions (spec 006, T11).

export interface ForgotPasswordState {
  /** Set after any answer that does not reveal whether the account exists (RF-1). */
  sent?: boolean;
  fieldErrors?: { email?: string };
  formError?: string;
  /** What was typed, so a failed submit does not lose it. */
  values: { email: string };
}

export interface ResetPasswordState {
  fieldErrors?: { password?: string };
  formError?: string;
}

// Ajustes forms (spec 006, iteration 2). `saved` drives the success message.

export type ProfileState = FormState<"displayName" | "timeZone"> & {
  saved?: boolean;
};

export interface PasswordChangeState {
  fieldErrors?: { currentPassword?: string; newPassword?: string };
  formError?: string;
  saved?: boolean;
}
