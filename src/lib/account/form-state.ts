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
