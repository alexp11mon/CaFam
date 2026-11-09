import {
  allDayToRange,
  parseDateKey,
  zonedLocalToUtc,
} from "@/lib/calendar/time-zone";
import type { ProposalRow } from "./schemas";

// Rows of a proposal (spec 022, plan "proposal-rows"). Pure: the proposal
// card and the server actions check the same rules.

export const ROW_MESSAGES = {
  title: "Escribe un título.",
  hours: "Indica la hora de inicio y la de fin.",
  endBeforeStart: "El fin tiene que ser posterior al inicio.",
} as const;

/** Instants of a row; the zone is the profile's (RF-19). Null if incomplete. */
export function rowInstants(
  row: ProposalRow,
  timeZone: string,
): { startsAt: string; endsAt: string } | null {
  if (row.allDay) return allDayToRange(row.startDate, row.endDate);
  if (!row.start || !row.end) return null;
  const at = (date: string, time: string) => {
    const day = parseDateKey(date);
    if (!day) return null;
    const [hour, minute] = time.split(":").map(Number) as [number, number];
    return zonedLocalToUtc({ ...day, hour, minute }, timeZone).toISOString();
  };
  const startsAt = at(row.startDate, row.start);
  const endsAt = at(row.endDate, row.end);
  return startsAt && endsAt ? { startsAt, endsAt } : null;
}

/** RF-35. The comparison is on wall-clock text, so no zone is needed. */
export function rowError(row: ProposalRow): string | null {
  if (!row.title.trim()) return ROW_MESSAGES.title;
  if (row.allDay) {
    return row.endDate < row.startDate ? ROW_MESSAGES.endBeforeStart : null;
  }
  if (!row.start || !row.end) return ROW_MESSAGES.hours;
  const start = `${row.startDate}T${row.start}`;
  const end = `${row.endDate}T${row.end}`;
  return end <= start ? ROW_MESSAGES.endBeforeStart : null;
}

/** RF-41. */
export function createLabel(count: number): string {
  return count === 1 ? "Crear 1 evento" : `Crear ${count} eventos`;
}

/** RF-35, RF-42: something selected and nothing selected in error. */
export function canCreate(rows: readonly ProposalRow[]): boolean {
  const selected = rows.filter((row) => row.selected);
  return selected.length > 0 && selected.every((row) => !rowError(row));
}
