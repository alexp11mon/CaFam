// Results returned by the auth Server Actions (plan "Server Actions").

export type SignUpField = "displayName" | "email" | "password";

export interface SignUpState {
  fieldErrors?: Partial<Record<SignUpField, string>>;
  formError?: string;
  values: { displayName: string; email: string };
}

export interface SignInState {
  formError?: string;
  /** The account waits for its link: the form offers to resend it (spec 049 RF-3). */
  unconfirmed?: boolean;
  values: { email: string };
}

/** "Reenviar" of the signup link (spec 049 RF-1, RF-3). */
export interface ResendState {
  status?: "sent" | "limited";
  formError?: string;
}

export type FormAction<State> = (
  prevState: State,
  formData: FormData,
) => Promise<State>;
