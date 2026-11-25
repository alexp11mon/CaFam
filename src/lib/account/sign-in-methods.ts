import type { User } from "@supabase/supabase-js";

// Spec 050, T3: the ways a user can enter (RF-5, RF-6). Supabase does not
// tell whether a password exists: an account made with email has the "email"
// identity, and one made with Google that creates a password is marked in
// its metadata by createPassword.

export interface SignInMethods {
  hasPassword: boolean;
  /** The Google address linked to the account, or null. */
  google: { email: string } | null;
}

export function signInMethods(user: User | null): SignInMethods {
  const identities = user?.identities ?? [];
  const google = identities.find((identity) => identity.provider === "google");
  const googleEmail = google?.identity_data?.email;
  return {
    hasPassword:
      identities.some((identity) => identity.provider === "email") ||
      user?.user_metadata?.has_password === true,
    google: google
      ? { email: typeof googleEmail === "string" ? googleEmail : "" }
      : null,
  };
}
