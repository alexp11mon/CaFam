import {
  addDays,
  formatDateKey,
  parseDateKey,
  weekdayIndex,
} from "@/lib/calendar/time-zone";
import { B, E, NUMBER, readNumber, type Scan } from "./tokenize";

// Dates of a new event in Spanish (spec 041 RF-1 to RF-3, RF-6). Pure: `today`
// is the date in the zone of the profile.

export type PartOfDay = "morning" | "afternoon" | "night";

export interface DateResult {
  date: string | null;
  /** Last day of a range ("del 3 al 5"), inclusive (RF-6). */
  endDate: string | null;
  /** "ayer": said in the preview (RF-1). */
  past: boolean;
  /** "esta noche": a time when none is given. */
  partOfDay: PartOfDay | null;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  setiembre: 9,
  sept: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};
const MONTH = `(${Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|")})\\.?`;

const WEEKDAYS: Record<string, number> = {
  lunes: 0,
  lun: 0,
  martes: 1,
  miercoles: 2,
  mie: 2,
  jueves: 3,
  jue: 3,
  viernes: 4,
  vie: 4,
  sabado: 5,
  sab: 5,
  domingo: 6,
  dom: 6,
};
export const WEEKDAY = `(${Object.keys(WEEKDAYS)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

export function weekdayNumber(word: string): number {
  return WEEKDAYS[word]!;
}

function valid(year: number, month: number, day: number): string | null {
  const key = formatDateKey({ year, month, day });
  const parts = parseDateKey(key);
  return parts && parts.month === month && parts.day === day ? key : null;
}

/** The day and month from today on: this year, or the next one(s). */
function nextDayMonth(
  today: string,
  month: number,
  day: number,
): string | null {
  const { year } = parseDateKey(today)!;
  // Up to 8 years ahead: 29 February.
  for (let y = year; y <= year + 8; y += 1) {
    const key = valid(y, month, day);
    if (key && key >= today) return key;
  }
  return null;
}

/** The next day of the month with that number (today included). */
function nextDay(today: string, day: number): string | null {
  const { year, month } = parseDateKey(today)!;
  for (let i = 0; i < 13; i += 1) {
    const m = ((month - 1 + i) % 12) + 1;
    const y = year + Math.floor((month - 1 + i) / 12);
    const key = valid(y, m, day);
    if (key && key >= today) return key;
  }
  return null;
}

/** The next such weekday; today counts only when `allowToday` (RF-2). */
export function nextWeekday(
  today: string,
  weekday: number,
  allowToday = false,
): string {
  let days = (weekday - weekdayIndex(today) + 7) % 7;
  if (days === 0 && !allowToday) days = 7;
  return addDays(today, days);
}

function fullYear(raw: string | undefined): number | null {
  if (!raw) return null;
  const year = Number(raw);
  return raw.length === 2 ? 2000 + year : year;
}

/** "20 de noviembre", "20 nov", "20/11", "20-11-2027" at the start of `text`. */
const DAY_MONTH = `(\\d{1,2})(?: de |\\s)${MONTH}(?: de (\\d{4}))?`;
const NUMERIC = `(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?`;

function dayMonth(
  today: string,
  day: string,
  month: string,
  year?: string,
): string | null {
  const m = MONTHS[month];
  if (!m) return null;
  const y = fullYear(year);
  return y ? valid(y, m, Number(day)) : nextDayMonth(today, m, Number(day));
}

function numeric(
  today: string,
  day: string,
  month: string,
  year?: string,
): string | null {
  // Spanish order: 1/2 is the 1st of February (RF-15).
  const y = fullYear(year);
  const m = Number(month);
  return y ? valid(y, m, Number(day)) : nextDayMonth(today, m, Number(day));
}

function explicit(today: string, text: string): string | null {
  let match = new RegExp(`^${DAY_MONTH}$`, "u").exec(text);
  if (match) return dayMonth(today, match[1]!, match[2]!, match[3]);
  match = new RegExp(`^${NUMERIC}$`, "u").exec(text);
  if (match) return numeric(today, match[1]!, match[2]!, match[3]);
  match = /^(\d{1,2})$/u.exec(text);
  if (match) return nextDay(today, Number(match[1]));
  return null;
}

function range(scan: Scan, today: string): DateResult | null {
  const one = `(\\d{1,2}(?:(?: de |\\s)${MONTH}(?: de \\d{4})?|[/-]\\d{1,2}(?:[/-](?:\\d{4}|\\d{2}))?)?)`;
  return (
    scan.first(
      `${B}del? (?:dia )?${one} al (?:dia )?${one}${E}`,
      "date",
      (m) => {
        let end = explicit(today, m[3]!);
        if (!end) return null;
        // "del 3 al 5 de diciembre": the first takes the month of the second.
        const last = parseDateKey(end)!;
        const start = /^\d{1,2}$/.test(m[1]!)
          ? valid(last.year, last.month, Number(m[1]))
          : explicit(today, m[1]!);
        if (!start) return null;
        // "del 28/12 al 2/1": the end is in the next year.
        if (end < start) {
          end = valid(last.year + 1, last.month, last.day);
          if (!end) return null;
        }
        if (end < start) return null;
        return { date: start, endDate: end, past: false, partOfDay: null };
      },
    ) ??
    scan.first(
      `${B}del? (?:proximo )?${WEEKDAY} al ${WEEKDAY}${E}`,
      "date",
      (m) => {
        const start = nextWeekday(today, weekdayNumber(m[1]!));
        const days = (weekdayNumber(m[2]!) - weekdayNumber(m[1]!) + 7) % 7;
        if (days === 0) return null;
        return {
          date: start,
          endDate: addDays(start, days),
          past: false,
          partOfDay: null,
        };
      },
    )
  );
}

function single(scan: Scan, today: string): DateResult | null {
  const result = (date: string | null, extra: Partial<DateResult> = {}) =>
    date
      ? { date, endDate: null, past: false, partOfDay: null, ...extra }
      : null;

  return (
    // "el viernes 27 de noviembre", "el sábado 21": the number decides.
    scan.first(
      `${B}(?:el )?${WEEKDAY},? (?:dia )?(${DAY_MONTH}|\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?|\\d{1,2})${E}`,
      "date",
      (m) => result(explicit(today, m[2]!.replace(/\.$/, ""))),
    ) ??
    scan.first(`${B}(?:el )?(?:dia )?${DAY_MONTH}${E}`, "date", (m) =>
      result(dayMonth(today, m[1]!, m[2]!, m[3])),
    ) ??
    // "10-12" without a year is a time range (RF-5), never a date.
    scan.first(`${B}(?:el )?(?:dia )?${NUMERIC}${E}`, "date", (m) =>
      m[0].includes("-") && !m[3]
        ? null
        : result(numeric(today, m[1]!, m[2]!, m[3])),
    ) ??
    scan.first(
      `${B}el (?:dia )?(\\d{1,2})${E}(?!:|h|\\s*(?:de la|am|pm|y |menos))`,
      "date",
      (m) => result(nextDay(today, Number(m[1]))),
    ) ??
    scan.first(`${B}pasado ma[nñ]ana${E}`, "date", () =>
      result(addDays(today, 2)),
    ) ??
    // Never "por la mañana" or "de la mañana", which are times (RF-4).
    scan.first(`(?<!(?:por|de|la|esta) )${B}ma[nñ]ana${E}`, "date", () =>
      result(addDays(today, 1)),
    ) ??
    scan.first(`${B}hoy${E}`, "date", () => result(today)) ??
    scan.first(`${B}ayer${E}`, "date", () =>
      result(addDays(today, -1), { past: true }),
    ) ??
    scan.first(`${B}esta (ma[nñ]ana|tarde|noche)${E}`, "date", (m) =>
      result(today, {
        partOfDay: m[1]!.startsWith("ma")
          ? "morning"
          : m[1] === "tarde"
            ? "afternoon"
            : "night",
      }),
    ) ??
    scan.first(`${B}(?:este|el) (?:fin de semana|finde)${E}`, "date", () =>
      result(nextWeekday(today, 5, true)),
    ) ??
    scan.first(
      `${B}(?:dentro de|en) (${NUMBER}) (dias?|semanas?|mes|meses)${E}`,
      "date",
      (m) => {
        const n = readNumber(m[1]!);
        if (!Number.isFinite(n) || n > 400) return null;
        if (m[2]!.startsWith("dia")) return result(addDays(today, n));
        if (m[2]!.startsWith("semana")) return result(addDays(today, 7 * n));
        const { year, month, day } = parseDateKey(today)!;
        const total = month - 1 + n;
        const y = year + Math.floor(total / 12);
        const mo = (total % 12) + 1;
        // 31 January + 1 month: the last day of February.
        for (let d = day; d >= 28; d -= 1) {
          const key = valid(y, mo, d);
          if (key) return result(key);
        }
        return result(valid(y, mo, day));
      },
    ) ??
    scan.first(
      `${B}(?:el )?(?:(?:proximo|este) )?${WEEKDAY}(?: (?:que viene|proximo))?${E}`,
      "date",
      (m) => result(nextWeekday(today, weekdayNumber(m[1]!))),
    )
  );
}

/** Takes the date of the text, if any. */
export function readDates(scan: Scan, today: string): DateResult {
  return (
    range(scan, today) ??
    single(scan, today) ?? {
      date: null,
      endDate: null,
      past: false,
      partOfDay: null,
    }
  );
}
