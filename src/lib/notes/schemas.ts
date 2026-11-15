import { z } from "zod";
import { isPaletteColor } from "@/lib/calendar/palette";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { ITEM_TEXT_MAX, NOTE_BODY_MAX, NOTE_TITLE_MAX } from "./limits";

const id = z.uuid({ error: "Identificador no válido." });

const title = z
  .string()
  .trim()
  .max(NOTE_TITLE_MAX, {
    error: `El título puede tener ${NOTE_TITLE_MAX} caracteres como mucho.`,
  });

export const itemTextSchema = z
  .string()
  .trim()
  .min(1, { error: "Escribe algo para añadirlo." })
  .max(ITEM_TEXT_MAX, {
    error: `Un elemento puede tener ${ITEM_TEXT_MAX} caracteres como mucho.`,
  });

export const createNoteSchema = z.object({
  id,
  kind: z.enum(["list", "text"], { error: "Elige lista o texto." }),
  title,
  calendarId: id.nullable(),
});

/** What can change in a note; only what is sent changes. */
export const noteFieldsSchema = z
  .object({
    title,
    body: z.string().max(NOTE_BODY_MAX, {
      error: `La nota puede tener ${NOTE_BODY_MAX.toLocaleString("es-ES", { useGrouping: "always" })} caracteres como mucho.`,
    }),
    color: z
      .string()
      .refine(isPaletteColor, { error: "Elige un color de la lista." })
      .nullable(),
    pinned: z.boolean(),
    archived: z.boolean(),
    dueDate: z
      .string()
      .refine((value) => parseDateKey(value) !== null, {
        error: "Elige una fecha válida.",
      })
      .nullable(),
    calendarId: id.nullable(),
  })
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, {
    error: "Nada que cambiar.",
  });

export const newItemSchema = z.object({
  id,
  text: itemTextSchema,
  position: z.number().int().min(0).max(100_000),
});

export const itemChangeSchema = z
  .object({ text: itemTextSchema, done: z.boolean() })
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, {
    error: "Nada que cambiar.",
  });

export const restoreItemSchema = newItemSchema.extend({ done: z.boolean() });

export const positionsSchema = z
  .array(z.object({ id, position: z.number().int().min(0).max(100_000) }))
  .min(1)
  .max(200);

export { id as noteIdSchema };
