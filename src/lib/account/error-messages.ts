import { getAuthErrorMessage } from "@/lib/auth/error-messages";

// Spec 006, T12: account messages in Spanish. None of them says whether an
// account exists (NF-1). Unknown codes and network failures fall back to the
// shared connection message (RF-12 of spec 001).

export const ACCOUNT_MESSAGES = {
  wrongCurrentPassword: "La contraseña actual no es correcta.",
  sameAsCurrent: "La contraseña nueva no puede ser igual a la actual.",
  emailInUse: "Esa dirección ya la usa otra cuenta.",
  invalidLink: "El enlace no es válido o ha caducado. Pide uno nuevo.",
  sameEmail: "Esa ya es tu dirección actual.",
  confirmationMismatch: "El email o la contraseña no coinciden.",
} as const;

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: ACCOUNT_MESSAGES.wrongCurrentPassword,
  same_password: ACCOUNT_MESSAGES.sameAsCurrent,
  email_exists: ACCOUNT_MESSAGES.emailInUse,
  user_already_exists: ACCOUNT_MESSAGES.emailInUse,
  otp_expired: ACCOUNT_MESSAGES.invalidLink,
};

/** The message for an account action's error; anything else is the connection message. */
export function getAccountErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    if (typeof code === "string" && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }
  }
  return getAuthErrorMessage(error);
}
