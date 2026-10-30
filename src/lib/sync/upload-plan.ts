import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { expandRows } from "@/lib/recurrence/read-series";
import { limitEvents } from "./limit-events";
import { syncWindow } from "./window";

interface Timed {
  starts_at: string;
  ends_at: string;
}

/** A row of the calendar with its series columns (spec 013). */
export interface UploadRow extends Timed {
  id: string;
  all_day: boolean;
  recurrence?: string | null;
  recurrence_tz?: string | null;
  exdates?: string[];
  series_id?: string | null;
  original_start?: string | null;
}

/**
 * Series cannot go to Google (spec 013 RF-30): each one becomes its
 * occurrences of the sync window, marked with `seriesId`; exceptions are rows
 * of their own and stay as they are. Server only: it expands with ical.js.
 */
export function withOccurrences<T extends UploadRow>(
  rows: T[],
  now: Date,
): { events: (T & { seriesId?: string })[]; series: number } {
  const { from, to } = syncWindow(now);
  const singles = rows.filter((row) => !row.recurrence);
  const series = rows.filter((row) => row.recurrence);
  const occurrences = expandRows(
    series.map((row) => ({
      ...row,
      recurrence: row.recurrence ?? null,
      recurrence_tz: row.recurrence_tz ?? null,
      exdates: row.exdates ?? [],
    })),
    singles.map((row) => ({
      series_id: row.series_id ?? null,
      original_start: row.original_start ?? null,
    })),
    from,
    to,
  ).map(({ row, occurrence }) => ({
    ...row,
    id: occurrenceId(row.id, occurrence.originalStart),
    starts_at: occurrence.startsAt,
    ends_at: occurrence.endsAt,
    seriesId: row.id,
  }));
  return { events: [...singles, ...occurrences], series: series.length };
}

/** The numbers shown before uploading, as of now (spec 009 RF-43, spec 013 RF-30). */
export function uploadCounts(rows: UploadRow[], now = new Date()) {
  const { events, series } = withOccurrences(rows, now);
  const { toGoogle, onlyCafam } = planUpload(events, now);
  return {
    toGoogle: toGoogle.length,
    onlyCafam,
    series,
    occurrences: toGoogle.filter((event) => event.seriesId).length,
  };
}

/**
 * Which events of an uploaded calendar go to Google: those of the sync window,
 * up to 2,000; the rest stay only in CaFam (RF-35, RF-42, RF-43).
 */
export function planUpload<T extends Timed>(
  events: T[],
  now: Date,
): { toGoogle: T[]; onlyCafam: number } {
  const { from, to } = syncWindow(now);
  const inside = events.filter(
    (event) =>
      Date.parse(event.ends_at) >= from.getTime() &&
      Date.parse(event.starts_at) <= to.getTime(),
  );
  const { events: toGoogle } = limitEvents(inside, now);
  return { toGoogle, onlyCafam: events.length - toGoogle.length };
}
