import { CALENDAR_MESSAGES } from "@/lib/calendar/error-messages";

// Messages of the event images (spec 012, plan "Contratos"). Usable in the
// browser: no server imports.
export const IMAGE_MESSAGES = {
  eventFull: "Este evento ya tiene 10 imágenes.",
  userFull:
    "Has llegado al límite de 300 imágenes. Borra alguna para subir más.",
  totalFull:
    "CaFam se ha quedado sin espacio para imágenes. Las que ya hay siguen guardadas.",
  gone: "Este evento ya no existe o ya no tienes acceso.",
  type: "Solo se admiten imágenes JPEG, PNG, WebP o HEIC.",
  tooBig: "La imagen pesa más de 20 MB.",
  unreadable: "Este navegador no puede leer esta imagen.",
  upload: "No se ha podido subir la imagen.",
  forbidden: CALENDAR_MESSAGES.forbidden,
  connection: CALENDAR_MESSAGES.connection,
} as const;

// CF429 carries which limit in its message (reserve_event_images).
const LIMITS: Record<string, string> = {
  event: IMAGE_MESSAGES.eventFull,
  user: IMAGE_MESSAGES.userFull,
  total: IMAGE_MESSAGES.totalFull,
};

const MESSAGES_BY_CODE: Record<string, string> = {
  CF404: IMAGE_MESSAGES.gone,
  // The objects are not in Storage: the upload did not finish.
  P0002: IMAGE_MESSAGES.upload,
  "42501": IMAGE_MESSAGES.forbidden,
};

/** Unknown codes, network errors and non-objects map to the connection message. */
export function getImageErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return IMAGE_MESSAGES.connection;
  }
  const { code } = error;
  const message = "message" in error ? error.message : undefined;
  if (code === "CF429" && typeof message === "string" && message in LIMITS) {
    return LIMITS[message];
  }
  if (typeof code === "string" && code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[code];
  }
  return IMAGE_MESSAGES.connection;
}

/** RF-20: only some of the chosen images fit in the event. */
export function fitNotice(
  requested: number,
  reserved: number,
): string | undefined {
  if (reserved >= requested) return undefined;
  const fits =
    reserved === 1
      ? "Solo cabe 1 imagen más"
      : `Solo caben ${reserved} imágenes más`;
  return `${fits} en este evento. No se han añadido las demás.`;
}
