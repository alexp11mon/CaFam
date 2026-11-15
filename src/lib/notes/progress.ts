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
): { text: string; late: boolean } | null {
  if (!dueDate) return null;
  const late = dueDate < today;
  if (dueDate === today) return { text: "Para hoy", late: false };
  const date = new Date(`${dueDate}T00:00:00Z`);
  const day = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return { text: late ? `Venció el ${day}` : `Para el ${day}`, late };
}
