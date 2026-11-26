// Due dates of notes and items (spec 048 RF-1, RF-2). Dates are YYYY-MM-DD
// keys and times HH:MM, read in the profile's zone. Pure.
import { addDays } from "@/lib/calendar/time-zone";
import { dateFormat } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";

const DAY = { weekday: "short", day: "numeric", timeZone: "UTC" } as const;
const DAY_MONTH = { ...DAY, month: "short" } as const;
// Spec 053: the three words in each language.
const WORDS: Record<Locale, [string, string, string]> = {
  es: ["hoy", "mañana", "ayer"],
  en: ["today", "tomorrow", "yesterday"],
};

/** "hoy", "mañana", "ayer", "vie 27" this month or "vie, 4 dic"; with " · 18:30". */
export function dueLabel(
  date: string,
  time: string | null | undefined,
  today: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const [todayWord, tomorrow, yesterday] = WORDS[locale];
  const day =
    date === today
      ? todayWord
      : date === addDays(today, 1)
        ? tomorrow
        : date === addDays(today, -1)
          ? yesterday
          : dateFormat(
              locale,
              date.slice(0, 7) === today.slice(0, 7) ? DAY : DAY_MONTH,
            ).format(new Date(`${date}T00:00:00Z`));
  return time ? `${day} · ${time.slice(0, 5)}` : day;
}

/** Past its day, or past its hour today. */
export function isOverdue(
  date: string,
  time: string | null | undefined,
  today: string,
  now: string,
): boolean {
  return date < today || (date === today && !!time && time.slice(0, 5) < now);
}

/** The closest due date of the pending items (the note card shows it). */
export function nextDue(
  items: readonly {
    done: boolean;
    dueDate?: string | null;
    dueTime?: string | null;
  }[],
): { date: string; time: string | null } | null {
  let best: { date: string; time: string | null } | null = null;
  for (const item of items) {
    if (item.done || !item.dueDate) continue;
    const time = item.dueTime ?? null;
    if (
      !best ||
      item.dueDate < best.date ||
      (item.dueDate === best.date && (time ?? "") < (best.time ?? ""))
    )
      best = { date: item.dueDate, time };
  }
  return best;
}

/** "Hoy", "Mañana" and "Próxima semana" (the next Monday). */
export function quickDates(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sunday
  return {
    today,
    tomorrow: addDays(today, 1),
    nextWeek: addDays(today, (8 - weekday) % 7 || 7),
  };
}
