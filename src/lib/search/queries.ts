import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEventRecord } from "@/lib/calendar/queries";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { expandRows } from "@/lib/recurrence/read-series";
import type { Database } from "@/types/database";
import {
  MAX_RESULTS,
  MIN_QUERY,
  MORE_BACK_YEARS,
  YEARS_AHEAD,
  YEARS_BACK,
} from "./limits";

// The event search (spec 039 plan "Servidor"). Server only: expandRows uses
// ical.js.

type Client = SupabaseClient<Database>;

export interface SearchResult extends CalendarEventRecord {
  /** The newest comment that matches, for the excerpt (RF-7). */
  matchedComment: string | null;
}

/** Rows read from search_events before expanding series. */
const ROWS = 300;

const COLUMNS =
  "id, calendar_id, title, starts_at, ends_at, all_day, color, category_id, location, recurrence, recurrence_tz, exdates, series_id, original_start, event_images(count), event_comments(count)";

function addYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

/** 1 year back to 2 ahead; each "Buscar más atrás" adds 2 years back (RF-5, D4). */
export function searchRange(now: Date, moreBack = 0): { from: Date; to: Date } {
  return {
    from: addYears(now, -YEARS_BACK - moreBack * MORE_BACK_YEARS),
    to: addYears(now, YEARS_AHEAD),
  };
}

/** Upcoming first ascending, then past newest first: what is kept at 100. */
function nearFirst(now: number) {
  return (a: SearchResult, b: SearchResult) => {
    const aPast = Date.parse(a.endsAt) <= now;
    const bPast = Date.parse(b.endsAt) <= now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    const diff = Date.parse(a.startsAt) - Date.parse(b.startsAt);
    return aPast ? -diff : diff;
  };
}

/**
 * Events of the user's calendars that match `query` in the period, one row
 * per occurrence of a series (RF-3 to RF-5, RF-8). RLS decides what is read.
 */
export async function searchEvents(
  supabase: Client,
  query: string,
  range: { from: Date; to: Date },
  now: Date = new Date(),
): Promise<{ results: SearchResult[]; more: boolean }> {
  if (query.trim().length < MIN_QUERY) return { results: [], more: false };
  const { data: matches, error } = await supabase.rpc("search_events", {
    p_query: query,
    p_from: range.from.toISOString(),
    p_to: range.to.toISOString(),
    p_limit: ROWS,
  });
  if (error) throw error;
  if (!matches?.length) return { results: [], more: false };

  const comments = new Map(
    matches.map((m) => [m.event_id, m.matched_comment ?? null]),
  );
  const { data: rows, error: rowsError } = await supabase
    .from("events")
    .select(COLUMNS)
    .in("id", [...comments.keys()]);
  if (rowsError) throw rowsError;

  const results: SearchResult[] = [];
  const seriesRows = (rows ?? []).filter((row) => row.recurrence);
  for (const row of rows ?? []) {
    if (row.recurrence) continue;
    results.push({
      id: row.id,
      calendarId: row.calendar_id,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day,
      color: row.color,
      categoryId: row.category_id,
      location: row.location,
      imageCount: row.event_images[0]?.count ?? 0,
      commentCount: row.event_comments[0]?.count ?? 0,
      seriesId: row.series_id,
      matchedComment: comments.get(row.id) ?? null,
    });
  }

  if (seriesRows.length > 0) {
    // Exceptions are rows of their own: they show only when they match.
    const { data: keys, error: keysError } = await supabase
      .from("events")
      .select("series_id, original_start")
      .in(
        "series_id",
        seriesRows.map((row) => row.id),
      );
    if (keysError) throw keysError;
    for (const { row, occurrence } of expandRows(
      seriesRows,
      keys ?? [],
      range.from,
      range.to,
    )) {
      results.push({
        id: occurrenceId(row.id, occurrence.originalStart),
        calendarId: row.calendar_id,
        title: row.title,
        startsAt: occurrence.startsAt,
        endsAt: occurrence.endsAt,
        allDay: row.all_day,
        color: row.color,
        categoryId: row.category_id,
        location: row.location,
        imageCount: 0,
        commentCount: 0,
        seriesId: row.id,
        matchedComment: comments.get(row.id) ?? null,
      });
    }
  }

  results.sort(nearFirst(now.getTime()));
  return {
    results: results.slice(0, MAX_RESULTS),
    more: results.length > MAX_RESULTS || matches.length >= ROWS,
  };
}
