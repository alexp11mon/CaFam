import { fromRRule, type RecurrenceRule, type Weekday } from "./rule";
import { WEEKDAYS } from "./schemas";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

// Spanish names shared by the quick options and the summary (RF-2, RF-5).

/** Monday first, like weekdayIndex and WEEKDAYS. */
export const WEEKDAY_NAMES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

export const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const UNITS = {
  daily: ["día", "días"],
  weekly: ["semana", "semanas"],
  monthly: ["mes", "meses"],
  yearly: ["año", "años"],
} as const;

const WORKWEEK = "MO,TU,WE,TH,FR";

function weekdayName(day: Weekday): string {
  return WEEKDAY_NAMES[WEEKDAYS.indexOf(day)]!;
}

/** "el lunes, el miércoles y el jueves". */
function listDays(days: Weekday[]): string {
  const names = [...days]
    .sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b))
    .map((day) => `el ${weekdayName(day)}`);
  return names.length === 1
    ? names[0]!
    : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

// Spec 053 RF-4: the same summary in English.
export const WEEKDAY_NAMES_EN = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const UNITS_EN = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
} as const;

/** 1st, 2nd, 3rd, 4th… */
export function ordinalEn(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "Every 2 weeks on Monday and Thursday, 10 times". */
function summarizeRuleEn(rule: RecurrenceRule): string {
  const [one, many] = UNITS_EN[rule.freq];
  let text =
    rule.interval === 1 ? `Every ${one}` : `Every ${rule.interval} ${many}`;
  const en = (day: Weekday) => WEEKDAY_NAMES_EN[WEEKDAYS.indexOf(day)]!;
  if (rule.freq === "weekly") {
    const sorted = [...rule.byDay].sort(
      (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
    );
    const names = sorted.map(en);
    text +=
      sorted.join(",") === WORKWEEK
        ? " from Monday to Friday"
        : ` on ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`}`;
  } else if (rule.freq === "monthly") {
    const { monthly } = rule;
    text +=
      "day" in monthly
        ? ` on day ${monthly.day}`
        : ` on the ${monthly.pos === -1 ? "last" : ordinalEn(monthly.pos)} ${en(monthly.weekday)}`;
  } else if (rule.freq === "yearly") {
    text += ` on ${MONTH_NAMES_EN[rule.yearly.month - 1]} ${rule.yearly.day}`;
  }
  if (rule.end.kind === "count") {
    text += `, ${rule.end.count} ${rule.end.count === 1 ? "time" : "times"}`;
  } else if (rule.end.kind === "until") {
    const [year, month, day] = rule.end.date.split("-").map(Number);
    text += `, until ${MONTH_NAMES_EN[month! - 1]} ${day}, ${year}`;
  }
  return text;
}

/** The summary of a stored RRULE in a language; "Se repite" if unreadable. */
export function summarizeRRule(recurrence: string, locale: Locale): string {
  const rule = fromRRule(recurrence);
  if (rule) return summarizeRule(rule, locale);
  return locale === "en" ? "Repeats" : "Se repite";
}

/** "Cada 2 semanas el lunes y el jueves, 10 veces" (RF-5, RF-10). */
export function summarizeRule(
  rule: RecurrenceRule,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === "en") return summarizeRuleEn(rule);
  const [one, many] = UNITS[rule.freq];
  let text =
    rule.interval === 1 ? `Cada ${one}` : `Cada ${rule.interval} ${many}`;

  if (rule.freq === "weekly") {
    const sorted = [...rule.byDay].sort(
      (a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b),
    );
    text +=
      sorted.join(",") === WORKWEEK
        ? " de lunes a viernes"
        : ` ${listDays(sorted)}`;
  } else if (rule.freq === "monthly") {
    const { monthly } = rule;
    text +=
      "day" in monthly
        ? ` el día ${monthly.day}`
        : ` el ${monthly.pos === -1 ? "último" : `${monthly.pos}.º`} ${weekdayName(monthly.weekday)}`;
  } else if (rule.freq === "yearly") {
    text += ` el ${rule.yearly.day} de ${MONTH_NAMES[rule.yearly.month - 1]}`;
  }

  if (rule.end.kind === "count") {
    text += `, ${rule.end.count} ${rule.end.count === 1 ? "vez" : "veces"}`;
  } else if (rule.end.kind === "until") {
    const [year, month, day] = rule.end.date.split("-").map(Number);
    text += `, hasta el ${day} de ${MONTH_NAMES[month! - 1]} de ${year}`;
  }
  return text;
}
