import { addDays, parseDateKey, weekdayIndex } from "@/lib/calendar/time-zone";
import { fromRRule, type RecurrenceRule, type Weekday } from "./rule";
import { WEEKDAYS } from "./schemas";
import { MONTH_NAMES, WEEKDAY_NAMES } from "./summary";

// "Repetir" quick options, worked out from the start date (RF-1, RF-2). The
// field keeps the kind of option and the server resolves it with the date it
// receives, so changing the date after choosing keeps it right (plan D13).

export type RepeatPreset =
  | "none"
  | "daily"
  | "weekly"
  | "monthly-day"
  | "monthly-pos"
  | "monthly-last"
  | "yearly"
  | "weekdays";

export const CUSTOM_PREFIX = "custom:";

export interface RepeatOption {
  value: RepeatPreset | "custom";
  label: string;
}

const NEVER = { kind: "never" } as const;

/** 1 to 5: which Monday, Tuesday… of its month the date is. */
function weekOfMonth(day: number): number {
  return Math.ceil(day / 7);
}

function isLastOfMonth(dateKey: string): boolean {
  return (
    parseDateKey(addDays(dateKey, 7))!.month !== parseDateKey(dateKey)!.month
  );
}

export function repeatOptions(dateKey: string): RepeatOption[] {
  const date = parseDateKey(dateKey);
  if (!date) return [{ value: "none", label: "No se repite" }];
  const weekday = WEEKDAY_NAMES[weekdayIndex(dateKey)];
  const position = weekOfMonth(date.day);
  const options: RepeatOption[] = [
    { value: "none", label: "No se repite" },
    { value: "daily", label: "Cada día" },
    { value: "weekly", label: `Cada semana el ${weekday}` },
    { value: "monthly-day", label: `Cada mes el día ${date.day}` },
  ];
  if (position <= 4) {
    options.push({
      value: "monthly-pos",
      label: `Cada mes el ${position}.º ${weekday}`,
    });
  }
  if (isLastOfMonth(dateKey)) {
    options.push({
      value: "monthly-last",
      label: `Cada mes el último ${weekday}`,
    });
  }
  options.push(
    {
      value: "yearly",
      label: `Cada año el ${date.day} de ${MONTH_NAMES[date.month - 1]}`,
    },
    { value: "weekdays", label: "Todos los días laborables (lunes a viernes)" },
    { value: "custom", label: "Personalizado…" },
  );
  return options;
}

export type ResolvedRepeat =
  { ok: true; rule: RecurrenceRule | null } | { ok: false };

/** From the value of the field to the rule; null rule = "No se repite". */
export function resolveRepeat(value: string, dateKey: string): ResolvedRepeat {
  if (value === "" || value === "none") return { ok: true, rule: null };
  if (value.startsWith(CUSTOM_PREFIX)) {
    const rule = fromRRule(value.slice(CUSTOM_PREFIX.length));
    return rule ? { ok: true, rule } : { ok: false };
  }
  const date = parseDateKey(dateKey);
  if (!date) return { ok: false };
  const weekday: Weekday = WEEKDAYS[weekdayIndex(dateKey)]!;
  const position = weekOfMonth(date.day);
  switch (value) {
    case "daily":
      return { ok: true, rule: { freq: "daily", interval: 1, end: NEVER } };
    case "weekly":
      return {
        ok: true,
        rule: { freq: "weekly", interval: 1, byDay: [weekday], end: NEVER },
      };
    case "weekdays":
      return {
        ok: true,
        rule: {
          freq: "weekly",
          interval: 1,
          byDay: ["MO", "TU", "WE", "TH", "FR"],
          end: NEVER,
        },
      };
    case "monthly-day":
      return {
        ok: true,
        rule: {
          freq: "monthly",
          interval: 1,
          monthly: { day: date.day },
          end: NEVER,
        },
      };
    case "monthly-pos":
      if (position > 4) return { ok: false };
      return {
        ok: true,
        rule: {
          freq: "monthly",
          interval: 1,
          monthly: { pos: position as 1 | 2 | 3 | 4, weekday },
          end: NEVER,
        },
      };
    case "monthly-last":
      if (!isLastOfMonth(dateKey)) return { ok: false };
      return {
        ok: true,
        rule: {
          freq: "monthly",
          interval: 1,
          monthly: { pos: -1, weekday },
          end: NEVER,
        },
      };
    case "yearly":
      return {
        ok: true,
        rule: {
          freq: "yearly",
          interval: 1,
          yearly: { month: date.month, day: date.day },
          end: NEVER,
        },
      };
    default:
      return { ok: false };
  }
}
