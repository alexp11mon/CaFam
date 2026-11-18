// The year view (spec 042 RF-1 to RF-5): its months and the marks of its days.
import type { MonthMarks } from "./month-marks";

/** "2026-01" … "2026-12": the months of the year of `date`. */
export function yearMonths(date: string): string[] {
  const year = date.slice(0, 4);
  return Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
}

/** The year of a date key, as a number. */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Marks from the rows of `calendar_day_marks` plus others (the series'), each calendar once a day. */
export function mergeMarks(
  rows: readonly { day: string; calendar_id: string }[],
  extra: MonthMarks = {},
): MonthMarks {
  const marks: MonthMarks = {};
  const add = (day: string, id: string) => {
    const ids = (marks[day] ??= []);
    if (!ids.includes(id)) ids.push(id);
  };
  for (const row of rows) add(row.day, row.calendar_id);
  for (const [day, ids] of Object.entries(extra)) {
    for (const id of ids) add(day, id);
  }
  return marks;
}
