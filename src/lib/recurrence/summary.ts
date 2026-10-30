import type { RecurrenceRule, Weekday } from "./rule";
import { WEEKDAYS } from "./schemas";

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

/** "Cada 2 semanas el lunes y el jueves, 10 veces" (RF-5, RF-10). */
export function summarizeRule(rule: RecurrenceRule): string {
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
