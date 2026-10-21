// Results returned by the auth Server Actions (plan "Server Actions").

export type SignUpField = "displayName" | "email" | "password";

export interface SignUpState {
  fieldErrors?: Partial<Record<SignUpField, string>>;
  formError?: string;
  values: { displayName: string; email: string };
}

export interface SignInState {
  formError?: string;
  values: { email: string };
}

export type FormAction<State> = (
  prevState: State,
  formData: FormData,
) => Promise<State>;
