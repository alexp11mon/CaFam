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
  position: z.number().min(0).max(100_000),
});

/** A due date and its optional time (spec 048 RF-1). */
export const itemDueSchema = {
  dueDate: z.iso.date({ error: "Fecha no válida." }).nullable(),
  dueTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Hora no válida." })
    .nullable(),
};

export const itemChangeSchema = z
  .object({ text: itemTextSchema, done: z.boolean(), ...itemDueSchema })
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, {
    error: "Nada que cambiar.",
  })
  .refine((fields) => !fields.dueTime || fields.dueDate, {
    error: "Una hora necesita su fecha.",
  });

/** The columns of an item change: the due fields are snake case there. */
export function itemRow(change: {
  text?: string;
  done?: boolean;
  dueDate?: string | null;
  dueTime?: string | null;
}) {
  const { dueDate, dueTime, ...rest } = change;
  return {
    ...rest,
    ...(dueDate !== undefined ? { due_date: dueDate } : {}),
    ...(dueTime !== undefined ? { due_time: dueTime } : {}),
  };
}

export const restoreItemSchema = newItemSchema.extend({ done: z.boolean() });

export const positionsSchema = z
  .array(z.object({ id, position: z.number().min(0).max(100_000) }))
  .min(1)
  .max(200);

export { id as noteIdSchema };
