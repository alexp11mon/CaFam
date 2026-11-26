import { dateFormat } from "@/lib/i18n/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale";
import { spanishT, type T } from "@/lib/i18n/translate";
import type { NoteItem } from "./types";

/** "3 de 8", or "Sin elementos". */
export function progress(items: readonly NoteItem[]) {
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  return {
    done,
    total,
    label: total === 0 ? "Sin elementos" : `${done} de ${total}`,
    complete: total > 0 && done === total,
  };
}

/** "Para el jueves, 19 de noviembre"; `late` once the day has passed. */
export function dueLabel(
  dueDate: string | null,
  today: string,
  t: T = spanishT,
  locale: Locale = DEFAULT_LOCALE,
): { text: string; late: boolean } | null {
  if (!dueDate) return null;
  const late = dueDate < today;
  if (dueDate === today) return { text: t("Para hoy"), late: false };
  const date = new Date(`${dueDate}T00:00:00Z`);
  const day = dateFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return {
    text: t(late ? "Venció el {day}" : "Para el {day}", { day }),
    late,
  };
}
