import { COMMENTS_PAGE } from "@/lib/comments/limits";
import type {
  OfflineComment,
  OfflineException,
  OfflineImage,
  OfflineSeries,
} from "@/lib/offline/snapshot";
import type { Supabase } from "./events/event-writes";

// What the copy of format 2 adds (spec 035 RF-13, RF-17, RF-29, plan D3):
// series with their totals, comments and ready images, all with the user's
// session and RLS (P3).

const PAGE = 1000;
/** Ids per `.in()`: the URL of a PostgREST query has a length limit. */
const CHUNK = 150;

function chunks<T>(items: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    out.push(items.slice(i, i + CHUNK));
  }
  return out;
}

/** Every row of a query over some ids, chunk by chunk and page by page. */
async function rowsFor<Row>(
  ids: readonly string[],
  read: (
    chunk: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const parts = await Promise.all(
    chunks(ids).map(async (chunk) => {
      const rows: Row[] = [];
      for (let page = 0; page < 20; page += 1) {
        const { data, error } = await read(
          chunk,
          page * PAGE,
          page * PAGE + PAGE - 1,
        );
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < PAGE) break;
      }
      return rows;
    }),
  );
  return parts.flat();
}

/** The series of the range, with what another person could change (D3). */
export async function seriesOf(
  supabase: Supabase,
  from: Date,
  to: Date,
): Promise<{ series: OfflineSeries[]; exceptions: OfflineException[] }> {
  const rows: OfflineSeries[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, calendar_id, title, description, location, color, category_id, starts_at, ends_at, all_day, recurrence, recurrence_tz, recurrence_until, exdates",
      )
      .not("recurrence", "is", null)
      .lt("starts_at", to.toISOString())
      .or(`recurrence_until.is.null,recurrence_until.gte.${from.toISOString()}`)
      .order("id")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    for (const row of data ?? []) {
      rows.push({
        id: row.id,
        calendarId: row.calendar_id,
        title: row.title,
        description: row.description,
        location: row.location,
        color: row.color,
        categoryId: row.category_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        allDay: row.all_day,
        recurrence: row.recurrence ?? "",
        recurrenceTz: row.recurrence_tz,
        recurrenceUntil: row.recurrence_until,
        exdates: row.exdates ?? [],
        totals: { exceptions: 0, images: 0, comments: 0, latest: null },
      });
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  // Every exception of those series, in the range or not (D3).
  const exceptions = await rowsFor(
    rows.map((row) => row.id),
    (chunk, a, b) =>
      supabase
        .from("events")
        .select("id, series_id, original_start, updated_at")
        .in("series_id", chunk)
        .order("id")
        .range(a, b),
  );
  const exceptionIds = exceptions.map((row) => row.id);
  const [images, comments] = await Promise.all([
    rowsFor(exceptionIds, (chunk, a, b) =>
      supabase
        .from("event_images")
        .select("event_id")
        .in("event_id", chunk)
        .eq("status", "ready")
        .order("id")
        .range(a, b),
    ),
    rowsFor(exceptionIds, (chunk, a, b) =>
      supabase
        .from("event_comments")
        .select("event_id")
        .in("event_id", chunk)
        .order("id")
        .range(a, b),
    ),
  ]);
  const seriesOfException = new Map(
    exceptions.map((row) => [row.id, row.series_id ?? ""]),
  );
  const totals = new Map(rows.map((row) => [row.id, row.totals]));
  for (const row of exceptions) {
    const total = totals.get(row.series_id ?? "");
    if (!total) continue;
    total.exceptions += 1;
    if (!total.latest || row.updated_at > total.latest) {
      total.latest = row.updated_at;
    }
  }
  for (const { event_id } of images) {
    const total = totals.get(seriesOfException.get(event_id) ?? "");
    if (total) total.images += 1;
  }
  for (const { event_id } of comments) {
    const total = totals.get(seriesOfException.get(event_id) ?? "");
    if (total) total.comments += 1;
  }
  return {
    series: rows,
    exceptions: exceptions.flatMap((row) =>
      row.series_id && row.original_start
        ? [
            {
              id: row.id,
              seriesId: row.series_id,
              originalStart: row.original_start,
            },
          ]
        : [],
    ),
  };
}

/** The 50 latest comments of each row, oldest first, with their author (RF-17). */
export async function commentsOf(
  supabase: Supabase,
  eventIds: readonly string[],
  authorName: (eventId: string, authorId: string | null) => string,
): Promise<OfflineComment[]> {
  const rows = await rowsFor(eventIds, (chunk, a, b) =>
    supabase
      .from("event_comments")
      .select("id, event_id, author_id, body, created_at, edited_at")
      .in("event_id", chunk)
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b),
  );
  const count = new Map<string, number>();
  const kept = rows.filter((row) => {
    const seen = count.get(row.event_id) ?? 0;
    count.set(row.event_id, seen + 1);
    return seen < COMMENTS_PAGE;
  });
  return kept.reverse().map((row) => ({
    id: row.id,
    eventId: row.event_id,
    authorId: row.author_id,
    authorName: authorName(row.event_id, row.author_id),
    body: row.body,
    createdAt: row.created_at,
    editedAt: row.edited_at,
  }));
}

/** The ready images of the rows; pending ones never (RF-29). */
export async function imagesOf(
  supabase: Supabase,
  eventIds: readonly string[],
): Promise<OfflineImage[]> {
  const rows = await rowsFor(eventIds, (chunk, a, b) =>
    supabase
      .from("event_images")
      .select("id, event_id, object_id, uploaded_by, created_at, width, height")
      .in("event_id", chunk)
      .eq("status", "ready")
      .order("created_at")
      .order("id")
      .range(a, b),
  );
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    objectId: row.object_id,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    width: row.width,
    height: row.height,
  }));
}
