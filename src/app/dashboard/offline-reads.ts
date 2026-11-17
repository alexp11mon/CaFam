import { authorLabel } from "@/lib/account/author-label";
import { todayKey } from "@/lib/calendar/format";
import {
  getAppearance,
  getCalendarProfile,
  getEventsInRange,
  getGroups,
  getMyCalendars,
  getMyCategories,
  getPeople,
  getPreferences,
} from "@/lib/calendar/queries";
import { daysRange } from "@/lib/calendar/ranges";
import { getNotes } from "@/lib/notes/queries";
import { offlineRange } from "@/lib/offline/range";
import {
  SNAPSHOT_FORMAT,
  type OfflineEvent,
  type Snapshot,
} from "@/lib/offline/snapshot";
import { fromRRule } from "@/lib/recurrence/rule";
import { summarizeRule } from "@/lib/recurrence/summary";
import { getMembers } from "@/lib/sharing/queries";
import type { Supabase } from "./events/event-writes";

// The full reading of the offline copy (spec 034 RF-1 to RF-3, RF-66, plan
// D8, D9). Shared by the server action and the integration tests; RLS limits
// every row (P3). Images, comments, "Ocupado" blocks, e-mails and the
// credentials of connected accounts are never read here (RF-66).

type DetailRow = {
  id: string;
  description: string | null;
  created_by: string | null;
  recurrence: string | null;
};

/** Description, author and rule of the rows the copy holds, page by page. */
async function detailRows(
  supabase: Supabase,
  from: Date,
  to: Date,
): Promise<Map<string, DetailRow>> {
  const rows = new Map<string, DetailRow>();
  const read = async (series: boolean) => {
    for (let page = 0; page < 20; page += 1) {
      let query = supabase
        .from("events")
        .select("id, description, created_by, recurrence")
        .lt("starts_at", to.toISOString());
      query = series
        ? query
            .not("recurrence", "is", null)
            .or(
              `recurrence_until.is.null,recurrence_until.gte.${from.toISOString()}`,
            )
        : query.is("recurrence", null).gte("ends_at", from.toISOString());
      const { data, error } = await query
        .order("id")
        .range(page * 1000, page * 1000 + 999);
      if (error) throw error;
      for (const row of data ?? []) rows.set(row.id, row);
      if ((data?.length ?? 0) < 1000) break;
    }
  };
  await Promise.all([read(false), read(true)]);
  return rows;
}

export async function readSnapshot(
  supabase: Supabase,
  userId: string,
  now: Date = new Date(),
): Promise<Snapshot> {
  const [
    profile,
    appearance,
    calendars,
    categories,
    groups,
    people,
    preferences,
    notes,
  ] = await Promise.all([
    getCalendarProfile(supabase, userId),
    getAppearance(supabase, userId),
    getMyCalendars(supabase, userId),
    getMyCategories(supabase),
    getGroups(supabase, userId),
    getPeople(supabase),
    getPreferences(supabase, userId),
    getNotes(supabase),
  ]);
  const today = todayKey(profile.timeZone, now);
  const range = offlineRange(today);
  const span = daysRange(range.from, range.to, profile.timeZone);
  const [records, details, members] = await Promise.all([
    getEventsInRange(supabase, span.from, span.to),
    detailRows(supabase, span.from, span.to),
    getMembers(
      supabase,
      calendars.map((calendar) => calendar.id),
    ),
  ]);

  const events: OfflineEvent[] = records.map((record) => {
    // An occurrence takes its series' text; an exception has its own row.
    const own = details.get(record.id);
    const series = record.seriesId ? details.get(record.seriesId) : undefined;
    const row = own ?? series;
    const rule = series?.recurrence ? fromRRule(series.recurrence) : null;
    const createdBy = row?.created_by ?? null;
    return {
      ...record,
      description: row?.description ?? null,
      createdBy,
      createdByName: row ? authorLabel(createdBy, members) : null,
      seriesSummary: record.seriesId
        ? rule
          ? summarizeRule(rule)
          : "Se repite"
        : null,
      seriesChanged: false,
    };
  });

  return {
    format: SNAPSHOT_FORMAT,
    userId,
    savedAt: now.toISOString(),
    today,
    range,
    profile: { ...profile, ...appearance },
    calendars,
    categories,
    groups,
    people,
    preferences,
    events,
    notes,
  };
}
