import { ITEMS_MAX, NOTES_MAX } from "./limits";

export const NOTE_MESSAGES = {
  connection:
    "No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.",
  gone: "Esta nota ya no existe o no tienes permiso para cambiarla.",
  forbidden: "No tienes permiso para hacer esto en esta nota.",
  invalid: "No se ha podido guardar: revisa lo que has escrito.",
  tooManyNotes: `Has llegado al máximo de ${NOTES_MAX} notas. Borra alguna para crear otra.`,
  tooManyItems: `Una lista admite ${ITEMS_MAX} elementos como mucho.`,
} as const;

/** A database error in the user's words (spec 028 RF-13). */
export function getNoteErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
): string {
  if (error?.code === "CF429") {
    return error.message === "items"
      ? NOTE_MESSAGES.tooManyItems
      : NOTE_MESSAGES.tooManyNotes;
  }
  if (error?.code === "42501") return NOTE_MESSAGES.forbidden;
  if (error?.code === "22023" || error?.code === "23514") {
    return NOTE_MESSAGES.invalid;
  }
  return NOTE_MESSAGES.connection;
}
