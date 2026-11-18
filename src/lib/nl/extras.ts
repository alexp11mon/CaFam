import type { RepeatPreset } from "@/lib/recurrence/presets";
import { WEEKDAY, weekdayNumber } from "./dates";
import { B, E, type Scan } from "./tokenize";

// Calendar, repetition, all day and place of a new event (spec 041 RF-6 to
// RF-8, RF-10). Pure.

/** "@familia": the name as written, matched later with matchCalendar (RF-8). */
export function readCalendar(scan: Scan): string | null {
  return scan.first(
    `(?<![\\p{L}\\p{N}@])@([\\p{L}\\p{N}_.-]+)`,
    "calendar",
    (m) =>
      scan.original
        .slice(m.index + 1, m.index + m[0].length)
        .replace(/[.]+$/u, ""),
  );
}

export interface RepeatResult {
  repeat: RepeatPreset;
  /** "cada lunes": the first one, when no date is given. */
  weekday: number | null;
}

/** Simple repetitions, proposed in "Repetir" (RF-10). */
export function readRepeat(scan: Scan): RepeatResult | null {
  const plain = (repeat: RepeatPreset) => ({ repeat, weekday: null });
  return (
    scan.first(
      `${B}(?:de lunes a viernes|entre semana|(?:todos los |los |cada )?dias laborables|cada dia laborable)${E}`,
      "repeat",
      () => plain("weekdays"),
    ) ??
    scan.first(`${B}(?:cada|todos los) ${WEEKDAY}${E}`, "repeat", (m) => ({
      repeat: "weekly",
      weekday: weekdayNumber(m[1]!),
    })) ??
    scan.first(
      `${B}(?:todos los dias|cada dia|a diario|diariamente)${E}`,
      "repeat",
      () => plain("daily"),
    ) ??
    scan.first(
      `${B}(?:todas las semanas|cada semana|semanalmente)${E}`,
      "repeat",
      () => plain("weekly"),
    ) ??
    scan.first(
      `${B}(?:todos los meses|cada mes|mensualmente)${E}`,
      "repeat",
      () => plain("monthly-day"),
    ) ??
    scan.first(
      `${B}(?:todos los anos|todos los años|cada ano|cada año|anualmente)${E}`,
      "repeat",
      () => plain("yearly"),
    )
  );
}

export function readAllDay(scan: Scan): boolean {
  return (
    scan.first(
      `${B}(?:todo el dia|(?:el )?dia (?:completo|entero))${E}`,
      "allDay",
      () => true,
    ) ?? false
  );
}

/**
 * What follows " en " up to the next recognized part (RF-7). Runs last, so
 * "en 2 semanas" is already a date.
 */
export function readLocation(scan: Scan): string | null {
  for (const run of scan.runs()) {
    const text = scan.norm.slice(run.start, run.end);
    const at = /(?<![\p{L}\p{N}])en\s+/u.exec(text);
    if (!at || run.start + at.index === 0) continue;
    const from = run.start + at.index + at[0].length;
    const raw = scan.original.slice(from, run.end);
    const place = raw.replace(/[\s,.;·-]+$/u, "");
    if (!/[\p{L}\p{N}]/u.test(place)) continue;
    scan.mark(run.start + at.index, from + place.length, "location");
    return place;
  }
  return null;
}
