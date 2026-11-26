import { ATTACH_MESSAGES } from "@/lib/assistant/attachments";
import { QUESTION_MESSAGES, QUOTA_TEXT } from "@/lib/assistant/error-messages";
import { DAILY_QUESTIONS, QUESTION_MAX } from "@/lib/assistant/limits";
import { COMMENT_MESSAGES } from "@/lib/comments/error-messages";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/limits";
import { formatNumber } from "@/lib/i18n/format";
import { MAX_BYTES } from "@/lib/ics/limits";
import { NOTE_MESSAGES } from "@/lib/notes/error-messages";
import {
  ITEM_TEXT_MAX,
  ITEMS_MAX,
  NOTE_BODY_MAX,
  NOTE_TITLE_MAX,
  NOTES_MAX,
} from "@/lib/notes/limits";
import { MAX_CALENDARS_PER_ACCOUNT } from "@/lib/sync/limits";
import { MAX_ATTACHMENTS } from "@/lib/assistant/attachments";

// Spec 053: messages built once from a limit. The key is the message itself
// (or the same text), so a changed limit changes both languages together.
const n = (value: number) => formatNumber("en", value);

export const limits: Record<string, string> = {
  [COMMENT_MESSAGES.tooLong]: `The comment cannot be longer than ${n(MAX_COMMENT_LENGTH)} characters.`,
  [COMMENT_MESSAGES.length]: `The comment must have between 1 and ${n(MAX_COMMENT_LENGTH)} characters.`,
  [NOTE_MESSAGES.tooManyNotes]: `You have reached the maximum of ${NOTES_MAX} notes. Delete one to create another.`,
  [NOTE_MESSAGES.tooManyItems]: `A list accepts ${ITEMS_MAX} items at most.`,
  [QUOTA_TEXT]: `You have asked today's ${DAILY_QUESTIONS} questions. You can carry on tomorrow.`,
  [QUESTION_MESSAGES.tooLong]: `The question can have ${QUESTION_MAX} characters at most.`,
  [ATTACH_MESSAGES.tooMany]: `You can attach ${MAX_ATTACHMENTS} images at most`,
  [`El título puede tener ${NOTE_TITLE_MAX} caracteres como mucho.`]: `The title can have ${NOTE_TITLE_MAX} characters at most.`,
  [`Un elemento puede tener ${ITEM_TEXT_MAX} caracteres como mucho.`]: `An item can have ${ITEM_TEXT_MAX} characters at most.`,
  [`La nota puede tener ${formatNumber("es", NOTE_BODY_MAX)} caracteres como mucho.`]: `The note can have ${n(NOTE_BODY_MAX)} characters at most.`,
  [`Puedes traer como máximo ${MAX_CALENDARS_PER_ACCOUNT} calendarios por cuenta.`]: `You can bring at most ${MAX_CALENDARS_PER_ACCOUNT} calendars per account.`,
  [`El archivo supera el límite de ${MAX_BYTES / (1024 * 1024)} MB.`]: `The file is over the ${MAX_BYTES / (1024 * 1024)} MB limit.`,
  "Escribe un nombre de 1 a 50 caracteres.":
    "Type a name of 1 to 50 characters.",
  "Escribe un nombre de 1 a 40 caracteres.":
    "Type a name of 1 to 40 characters.",
  // Texts with a .ics or a URL, which the scanner reads as code.
  "CaFam recibe archivos .ics, imágenes y texto.":
    "CaFam receives .ics files, images and text.",
  "El enlace no es válido. Debe empezar por https:// o webcal://.":
    "The link is not valid. It must start with https:// or webcal://.",
  "El contenido no es un calendario .ics válido.":
    "The content is not a valid .ics calendar.",
};
