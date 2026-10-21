import { z } from "zod";
import { fieldErrorsFromZod, type ParseResult } from "@/lib/forms/form-state";
import { DEFAULT_CALENDAR_COLOR, isPaletteColor } from "./palette";
import {
  allDayToRange,
  parseDateKey,
  zonedLocalToUtc,
  type LocalDateTime,
} from "./time-zone";

const COLOR_MESSAGE = "Elige uno de los colores de la paleta.";

function nameField(max: number) {
  return z
    .string()
    .trim()
    .min(1, `Escribe un nombre de 1 a ${max} caracteres.`)
    .max(max, `Escribe un nombre de 1 a ${max} caracteres.`);
}

function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);
}

const paletteColor = z
  .string()
  .trim()
  .refine(isPaletteColor, COLOR_MESSAGE)
  .transform((value) => value.toUpperCase());

// Calendar (RF-1, RF-2, RF-4) and category (RF-9) -----------------------------

export type CalendarField = "name" | "description" | "color";

export const calendarSchema = z.object({
  name: nameField(50),
  description: optionalText(
    500,
    "La descripción no puede superar los 500 caracteres.",
  ),
  color: paletteColor,
});

export const categorySchema = z.object({ name: nameField(40) });

// Event (RF-15..RF-21) ---------------------------------------------------------

export type EventField =
  | "title"
  | "calendarId"
  | "startDate"
  | "startTime"
  | "endDate"
  | "endTime"
  | "description"
  | "location"
  | "color"
  | "categoryId";

/** Raw form values; dates are YYYY-MM-DD and times HH:mm in the profile's zone. */
export interface EventFormInput {
  title: string;
  calendarId: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description: string;
  location: string;
  color: string;
  categoryId: string;
}

export interface EventData {
  title: string;
  calendarId: string;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
  description: string | null;
  location: string | null;
  color: string | null;
  categoryId: string | null;
}

const eventTextSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe un título de 1 a 100 caracteres.")
    .max(100, "Escribe un título de 1 a 100 caracteres."),
  calendarId: z.uuid({ error: "Elige un calendario." }),
  description: optionalText(
    2000,
    "La descripción no puede superar los 2000 caracteres.",
  ),
  location: optionalText(200, "El lugar no puede superar los 200 caracteres."),
  color: z
    .string()
    .trim()
    .transform((value) => value || null)
    .refine((value) => value === null || isPaletteColor(value), COLOR_MESSAGE)
    .transform((value) => value?.toUpperCase() ?? null),
  categoryId: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.uuid({ error: "Elige una categoría válida." }).nullable()),
});

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

const END_BEFORE_START = "El fin no puede ser anterior al inicio.";

/**
 * Validates the event form and converts it to what is stored: timed events as
 * UTC instants from the profile's zone, all-day events as UTC dates (plan D6).
 */
export function parseEventInput(
  raw: EventFormInput,
  timeZone: string,
): ParseResult<EventData, EventField> {
  const text = eventTextSchema.safeParse(raw);
  const errors: Partial<Record<EventField, string>> = text.success
    ? {}
    : fieldErrorsFromZod<EventField>(text.error);

  const startDay = parseDateKey(raw.startDate);
  const endDay = parseDateKey(raw.endDate);
  if (!startDay) errors.startDate = "Introduce una fecha de inicio válida.";
  if (!endDay) errors.endDate = "Introduce una fecha de fin válida.";

  let startsAt = "";
  let endsAt = "";
  if (startDay && endDay) {
    if (raw.allDay) {
      if (raw.endDate < raw.startDate) errors.endDate = END_BEFORE_START;
      ({ startsAt, endsAt } = allDayToRange(raw.startDate, raw.endDate));
    } else {
      const startTime = parseTime(raw.startTime);
      const endTime = parseTime(raw.endTime);
      if (!startTime) errors.startTime = "Introduce una hora de inicio válida.";
      if (!endTime) errors.endTime = "Introduce una hora de fin válida.";
      if (startTime && endTime) {
        const start = zonedLocalToUtc(
          { ...startDay, ...startTime } satisfies LocalDateTime,
          timeZone,
        );
        const end = zonedLocalToUtc(
          { ...endDay, ...endTime } satisfies LocalDateTime,
          timeZone,
        );
        if (end < start) {
          errors[raw.endDate < raw.startDate ? "endDate" : "endTime"] =
            END_BEFORE_START;
        }
        startsAt = start.toISOString();
        endsAt = end.toISOString();
      }
    }
  }

  if (!text.success || Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return {
    ok: true,
    data: { ...text.data, allDay: raw.allDay, startsAt, endsAt },
  };
}

// Merge calendars (RF-49, RF-50) ----------------------------------------------

export type MergeField = "sourceIds" | "targetId" | "newName" | "newColor";

export interface MergeFormInput {
  sourceIds: string[];
  /** One of `sourceIds`, or empty to create a new calendar. */
  targetId: string;
  newName: string;
  newColor: string;
}

export interface MergeData {
  sourceIds: string[];
  targetId: string | null;
  name: string | null;
  color: string | null;
}

export function parseMergeInput(
  raw: MergeFormInput,
): ParseResult<MergeData, MergeField> {
  const errors: Partial<Record<MergeField, string>> = {};
  const sourceIds = [...new Set(raw.sourceIds.filter(Boolean))];
  if (
    sourceIds.length < 2 ||
    !sourceIds.every((id) => z.uuid().safeParse(id).success)
  ) {
    errors.sourceIds = "Elige al menos dos calendarios.";
  }

  const targetId = raw.targetId.trim();
  let name: string | null = null;
  let color: string | null = null;
  if (targetId) {
    if (!sourceIds.includes(targetId)) {
      errors.targetId =
        "El resultado debe ser uno de los calendarios elegidos.";
    }
  } else {
    const parsedName = nameField(50).safeParse(raw.newName);
    const parsedColor = paletteColor.safeParse(
      raw.newColor.trim() || DEFAULT_CALENDAR_COLOR,
    );
    if (!parsedName.success)
      errors.newName = parsedName.error.issues[0]?.message;
    else name = parsedName.data;
    if (!parsedColor.success) errors.newColor = COLOR_MESSAGE;
    else color = parsedColor.data;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: { sourceIds, targetId: targetId || null, name, color },
  };
}
