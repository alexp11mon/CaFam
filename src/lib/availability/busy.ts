import { utcDateKey } from "@/lib/calendar/time-zone";

// Other people's busy times for the week and day grid (spec 020 plan D3). Pure:
// the rows come already expanded and reduced to times by grid_busy.

/** One busy interval of a person, a repetition already expanded. */
export interface BusyInput {
  personId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

/** What the user already sees in the grid. */
export interface VisibleTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface BusyBlock {
  personId: string;
  startsAt: string;
  endsAt: string;
}

/** All-day busy days, by UTC date like all-day events; `endDate` exclusive. */
export interface BusyDay {
  personId: string;
  startDate: string;
  endDate: string;
}

const key = (t: VisibleTimes) =>
  `${t.allDay}|${Date.parse(t.startsAt)}|${Date.parse(t.endsAt)}`;

/** Merges intervals that overlap or touch, per person, in start order (RF-12). */
function merge(items: { personId: string; start: number; end: number }[]) {
  const sorted = [...items].sort(
    (a, b) => a.personId.localeCompare(b.personId) || a.start - b.start,
  );
  const merged: typeof items = [];
  for (const item of sorted) {
    const last = merged.at(-1);
    if (last && last.personId === item.personId && item.start <= last.end) {
      last.end = Math.max(last.end, item.end);
    } else {
      merged.push({ ...item });
    }
  }
  return merged;
}

/**
 * Busy blocks without what the user already sees (RF-13, before merging, D3),
 * merged per person (RF-12); all-day events go to the all-day strip (RF-11).
 */
export function busyBlocks(
  rows: readonly BusyInput[],
  visible: readonly VisibleTimes[],
): { timed: BusyBlock[]; allDay: BusyDay[] } {
  const seen = new Set(visible.map(key));
  const kept = rows
    .filter((row) => !seen.has(key(row)))
    .map((row) => ({
      personId: row.personId,
      allDay: row.allDay,
      start: Date.parse(row.startsAt),
      end: Date.parse(row.endsAt),
    }));

  const timed = merge(kept.filter((r) => !r.allDay)).map((b) => ({
    personId: b.personId,
    startsAt: new Date(b.start).toISOString(),
    endsAt: new Date(b.end).toISOString(),
  }));
  const allDay = merge(kept.filter((r) => r.allDay)).map((b) => ({
    personId: b.personId,
    startDate: utcDateKey(b.start),
    endDate: utcDateKey(b.end),
  }));
  return { timed, allDay };
}
