import { AUTH_MESSAGES } from "@/lib/auth/error-messages";

export const CALENDAR_MESSAGES = {
  duplicateCategory: "Ya existe una categoría con ese nombre.",
  duplicateGroup: "Ya tienes un grupo con ese nombre.",
  groupGone: "Ese grupo ya no existe.",
  forbidden: "No tienes permiso para hacer esto.",
  forbiddenMerge: "Solo puedes juntar calendarios de los que eres propietario.",
  foreignCategory: "Esa categoría no existe en el calendario elegido.",
  notFound: "Este elemento ya no existe.",
  invalidData: "Revisa los datos e inténtalo de nuevo.",
  connection: AUTH_MESSAGES.connection,
} as const;

// Postgres / PostgREST codes raised by the spec 002 schema (plan "Mensajes de error").
const MESSAGES_BY_CODE: Record<string, string> = {
  // The only unique constraint users can hit is the category name per calendar (RF-10).
  "23505": CALENDAR_MESSAGES.duplicateCategory,
  "42501": CALENDAR_MESSAGES.forbidden,
  "23503": CALENDAR_MESSAGES.foreignCategory,
  PGRST116: CALENDAR_MESSAGES.notFound,
  "22023": CALENDAR_MESSAGES.invalidData,
  "23514": CALENDAR_MESSAGES.invalidData,
};

/** Unknown codes, network errors and non-objects all map to the connection message. */
export function getCalendarErrorMessage(
  error: unknown,
  operation?: "merge",
): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    if (code === "42501" && operation === "merge") {
      return CALENDAR_MESSAGES.forbiddenMerge;
    }
    if (typeof code === "string" && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }
  }
  return CALENDAR_MESSAGES.connection;
}
