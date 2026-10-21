export const AUTH_MESSAGES = {
  emailTaken: "Ya existe una cuenta con este email.",
  invalidCredentials: "Email o contraseña incorrectos.",
  weakPassword: "La contraseña debe tener al menos 8 caracteres.",
  rateLimited: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  connection:
    "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
} as const;

// Supabase Auth error codes (plan "Traducción de errores").
const MESSAGES_BY_CODE: Record<string, string> = {
  user_already_exists: AUTH_MESSAGES.emailTaken,
  email_exists: AUTH_MESSAGES.emailTaken,
  invalid_credentials: AUTH_MESSAGES.invalidCredentials,
  weak_password: AUTH_MESSAGES.weakPassword,
  over_request_rate_limit: AUTH_MESSAGES.rateLimited,
  over_email_send_rate_limit: AUTH_MESSAGES.rateLimited,
};

/** Network errors, 5xx and unknown codes all map to the connection message (RF-12). */
export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    if (typeof code === "string" && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }
  }
  return AUTH_MESSAGES.connection;
}
