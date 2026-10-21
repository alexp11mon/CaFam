import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";

export const SHARING_MESSAGES = {
  invalidInvite: "Esta invitación ya no es válida.",
  invalidCode: "ID o PIN incorrectos.",
  limited: "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
  ownerCannotLeave:
    "El propietario no puede salir de su calendario ni ser expulsado. Para dejar de serlo, borra el calendario.",
  forbidden: CALENDAR_MESSAGES.forbidden,
  invalidData: CALENDAR_MESSAGES.invalidData,
  connection: CALENDAR_MESSAGES.connection,
} as const;

// CF404 and CF429 are the custom SQLSTATEs of the spec 003 functions
// ("invite not valid" and "too many attempts"); 42501 and 22023 are standard.
const MESSAGES_BY_CODE: Record<string, string> = {
  CF404: SHARING_MESSAGES.invalidInvite,
  CF429: SHARING_MESSAGES.limited,
  "42501": SHARING_MESSAGES.forbidden,
  "22023": SHARING_MESSAGES.invalidData,
};

/** Unknown codes, network errors and non-objects all map to the connection message. */
export function getSharingErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;
    if (typeof code === "string" && code in MESSAGES_BY_CODE) {
      return MESSAGES_BY_CODE[code];
    }
  }
  return SHARING_MESSAGES.connection;
}

/** Message for the failing statuses of `join_with_code` (RF-20..RF-22). */
export function getJoinStatusMessage(status: "invalid" | "limited"): string {
  return status === "limited"
    ? SHARING_MESSAGES.limited
    : SHARING_MESSAGES.invalidCode;
}
