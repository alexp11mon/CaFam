import { expandSeries, type Occurrence, type SeriesInput } from "./expand";
import { fromRRule } from "./rule";

// From the rows of a series to its occurrences (plan "series-queries"). Server
// only, like expand.ts.

export interface SeriesRow {
  id: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  recurrence: string | null;
  recurrence_tz: string | null;
  exdates: string[];
}

/** (series_id, original_start) of an exception: its occurrence is not expanded. */
export interface ExceptionKey {
  series_id: string | null;
  original_start: string | null;
}

export function seriesInput(row: SeriesRow): SeriesInput {
  return {
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    recurrence: row.recurrence ?? "",
    recurrenceTz: row.recurrence_tz,
  };
}

function skipped(row: SeriesRow, keys: readonly ExceptionKey[]): Set<number> {
  const skip = new Set(row.exdates.map((date) => Date.parse(date)));
  for (const key of keys) {
    if (key.series_id === row.id && key.original_start) {
      skip.add(Date.parse(key.original_start));
    }
  }
  return skip;
}

/**
 * Occurrences of each series in [from, to) without those replaced by an
 * exception or deleted (RF-9, RF-11). An unreadable rule is skipped and
 * reported on the server instead of breaking the views (plan R3).
 */
export function expandRows<Row extends SeriesRow>(
  rows: readonly Row[],
  keys: readonly ExceptionKey[],
  from: Date,
  to: Date,
): { row: Row; occurrence: Occurrence }[] {
  return rows.flatMap((row) => {
    if (!fromRRule(row.recurrence ?? "")) {
      console.warn(`Series ${row.id} has an unreadable rule; skipped.`);
      return [];
    }
    return expandSeries(seriesInput(row), from, to, skipped(row, keys)).map(
      (occurrence) => ({ row, occurrence }),
    );
  });
}

/** The occurrence of a series that starts at `originalStart`, if the rule gives one. */
export function findOccurrence(
  row: SeriesRow,
  originalStart: string,
  keys: readonly ExceptionKey[] = [],
): Occurrence | null {
  const at = Date.parse(originalStart);
  if (Number.isNaN(at)) return null;
  return (
    expandSeries(
      seriesInput(row),
      new Date(at),
      new Date(at + 1),
      skipped(row, keys),
    ).find((occurrence) => Date.parse(occurrence.originalStart) === at) ?? null
  );
}

interface Content {
  title: string;
  description: string | null;
  location: string | null;
  color: string | null;
  category_id: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
}

/**
 * Whether an exception differs from what its series would give: an unchanged
 * one only exists to hold images and shows as a plain occurrence (plan D9).
 */
export function isChanged(
  exception: Content & { original_start: string | null },
  series: Content & SeriesRow,
): boolean {
  const occurrence = exception.original_start
    ? findOccurrence({ ...series, exdates: [] }, exception.original_start)
    : null;
  if (!occurrence) return true;
  return (
    exception.title !== series.title ||
    exception.description !== series.description ||
    exception.location !== series.location ||
    exception.color !== series.color ||
    exception.category_id !== series.category_id ||
    exception.all_day !== series.all_day ||
    Date.parse(exception.starts_at) !== Date.parse(occurrence.startsAt) ||
    Date.parse(exception.ends_at) !== Date.parse(occurrence.endsAt)
  );
}
