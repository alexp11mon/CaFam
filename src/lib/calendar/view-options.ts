import { z } from "zod";
import { weekdayIndex } from "./time-zone";

/** Lengths of a new event offered in Ajustes, in minutes (spec 019 RF-30). */
export const DURATIONS = [15, 30, 45, 60, 90, 120] as const;
export type Duration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: Duration = 60;

export const durationSchema = z
  .number()
  .refine((value): value is Duration => DURATIONS.includes(value as Duration), {
    message: "Elige una duración de la lista.",
  });

/** A stored duration, or 60 when it is missing or unknown. */
export function parseDuration(value: unknown): Duration {
  return DURATIONS.includes(value as Duration)
    ? (value as Duration)
    : DEFAULT_DURATION;
}

/** "45 min", "1 h", "1 h 30 min". */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The days week and month draw: without Saturday and Sunday if hidden (RF-25, RF-26). */
export function visibleDays(days: string[], showWeekends: boolean): string[] {
  return showWeekends ? days : days.filter((day) => weekdayIndex(day) < 5);
}
