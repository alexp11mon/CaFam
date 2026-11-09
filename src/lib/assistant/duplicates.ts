import { rowError, rowInstants } from "./proposal-rows";
import type { ProposalRow } from "./schemas";

// Duplicates of a proposal (spec 022, plan D8): same calendar, start and end
// as an event the user can see. The events come from getEventsInRange, so
// the occurrences of a series count too.

export interface ExistingEvent {
  calendarId: string;
  startsAt: string;
  endsAt: string;
}

/**
 * RF-37: a row that becomes a duplicate is unselected; one that was already
 * marked keeps the user's choice (RF-38); an edit can clear the mark (RF-39).
 */
export function markDuplicates(
  rows: readonly ProposalRow[],
  events: readonly ExistingEvent[],
  timeZone: string,
): ProposalRow[] {
  const taken = new Set(
    events.map(
      (e) =>
        `${e.calendarId}|${Date.parse(e.startsAt)}|${Date.parse(e.endsAt)}`,
    ),
  );
  return rows.map((row) => {
    const instants = rowError(row) ? null : rowInstants(row, timeZone);
    if (!instants) return row;
    const duplicate = taken.has(
      `${row.calendarId}|${Date.parse(instants.startsAt)}|${Date.parse(instants.endsAt)}`,
    );
    if (duplicate === row.duplicate) return row;
    return duplicate
      ? { ...row, duplicate, selected: false }
      : { ...row, duplicate };
  });
}
