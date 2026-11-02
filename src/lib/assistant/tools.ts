import type { createClient } from "@/lib/supabase/server";
import { getEventsInRange, getMyCalendars } from "@/lib/calendar/queries";
import { addDays } from "@/lib/calendar/time-zone";
import { todayKey } from "@/lib/calendar/format";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { expandRows } from "@/lib/recurrence/read-series";
import type { Refs } from "./citations";
import { dayBounds, parsePeriod, weekdayName } from "./dates";
import { busyFromEvent, freeSlots, type BusyInterval } from "./free-slots";
import {
  DEFAULT_RANGES,
  MAX_FREE_DAYS,
  MAX_LIST_DAYS,
  MAX_LISTED_EVENTS,
  MAX_SEARCH_RESULTS,
  SEARCH_WINDOW_DAYS,
} from "./limits";
import { matchPerson } from "./people-match";
import {
  freeTimeArgsSchema,
  listEventsArgsSchema,
  searchArgsSchema,
} from "./schemas";
import { toModelEvent } from "./serialize";

export { TOOL_DEFINITIONS } from "./tool-definitions";

// The assistant's read-only tools (spec 015 plan assistant-tools, D2). They
// run with the user's session, so RLS decides what they see (RF-10, RF-29);
// other people's private times only come from assistant_busy (RF-20, RF-23).

type Client = Awaited<ReturnType<typeof createClient>>;

/** An event the answer can cite: the ids stay on the server and the browser (D5). */
export interface CitedEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  calendarName: string;
  color: string;
}

export interface ToolContext {
  supabase: Client;
  userId: string;
  timeZone: string;
  now: Date;
  refs: Refs<CitedEvent>;
  /** RF-31, D12: leave out Google calendars if the provider trained on data. */
  excludeSynced: boolean;
}

interface CalendarInfo {
  name: string;
  color: string;
  google: boolean;
}

async function calendarsOf(
  ctx: ToolContext,
): Promise<Map<string, CalendarInfo>> {
  const calendars = await getMyCalendars(ctx.supabase, ctx.userId);
  return new Map(
    calendars.map((calendar) => [
      calendar.id,
      {
        name: calendar.name,
        color: calendar.color,
        google: calendar.synced?.provider === "google",
      },
    ]),
  );
}

function visible(
  events: readonly EventLike[],
  calendars: Map<string, CalendarInfo>,
  ctx: ToolContext,
): EventLike[] {
  return events.filter((event) => {
    const calendar = calendars.get(event.calendarId);
    return calendar && !(ctx.excludeSynced && calendar.google);
  });
}

interface EventLike {
  id: string;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
}

function serialize(
  events: readonly EventLike[],
  calendars: Map<string, CalendarInfo>,
  ctx: ToolContext,
) {
  return events.map((event) => {
    const calendar = calendars.get(event.calendarId)!;
    const ref = ctx.refs.add({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      calendarName: calendar.name,
      color: calendar.color,
    });
    return toModelEvent(ref, event, calendar.name, ctx.timeZone);
  });
}

async function listEvents(args: unknown, ctx: ToolContext) {
  const parsed = listEventsArgsSchema.safeParse(args);
  if (!parsed.success) return { status: "invalid_arguments" };
  const period = parsePeriod(
    parsed.data.from,
    parsed.data.to,
    ctx.timeZone,
    MAX_LIST_DAYS,
  );
  if (period.status !== "ok") return { status: period.status };

  const [events, calendars] = await Promise.all([
    getEventsInRange(ctx.supabase, period.from, period.to),
    calendarsOf(ctx),
  ]);
  // getEventsInRange includes events ending exactly at the start.
  const inPeriod = visible(events, calendars, ctx).filter(
    (event) => Date.parse(event.endsAt) > period.from.getTime(),
  );
  return {
    total: inPeriod.length,
    truncated: inPeriod.length > MAX_LISTED_EVENTS,
    events: serialize(inPeriod.slice(0, MAX_LISTED_EVENTS), calendars, ctx),
  };
}

const SEARCH_COLUMNS =
  "id, calendar_id, title, location, starts_at, ends_at, all_day, recurrence, recurrence_tz, exdates";

/** ilike pattern with the user's % and _ taken literally (D11). */
const likePattern = (query: string) =>
  `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

async function searchEvents(args: unknown, ctx: ToolContext) {
  const parsed = searchArgsSchema.safeParse(args);
  if (!parsed.success) return { status: "invalid_arguments" };
  const today = todayKey(ctx.timeZone, ctx.now);
  const from = dayBounds(
    addDays(today, -SEARCH_WINDOW_DAYS),
    ctx.timeZone,
  ).start;
  const to = dayBounds(addDays(today, SEARCH_WINDOW_DAYS), ctx.timeZone).end;
  const pattern = likePattern(parsed.data.query);

  // One query per column: no PostgREST `or` string to escape.
  const results = await Promise.all(
    (["title", "location", "description"] as const).map((column) =>
      ctx.supabase
        .from("events")
        .select(SEARCH_COLUMNS)
        .ilike(column, pattern)
        .lt("starts_at", to.toISOString())
        .limit(200),
    ),
  );
  const rows = new Map<string, NonNullable<(typeof results)[0]["data"]>[0]>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of data ?? []) rows.set(row.id, row);
  }
  const calendars = await calendarsOf(ctx);
  const all = [...rows.values()];

  const series = all.filter((row) => row.recurrence !== null);
  const { data: keys, error } = series.length
    ? await ctx.supabase
        .from("events")
        .select("series_id, original_start")
        .in(
          "series_id",
          series.map((row) => row.id),
        )
    : { data: [], error: null };
  if (error) throw error;

  const found: EventLike[] = [
    ...all
      .filter(
        (row) =>
          row.recurrence === null && Date.parse(row.ends_at) > from.getTime(),
      )
      .map((row) => ({
        id: row.id,
        calendarId: row.calendar_id,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        allDay: row.all_day,
        location: row.location,
      })),
    ...expandRows(series, keys ?? [], from, to).map(({ row, occurrence }) => ({
      id: occurrenceId(row.id, occurrence.originalStart),
      calendarId: row.calendar_id,
      title: row.title,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      allDay: row.all_day,
      location: row.location,
    })),
  ];
  const matches = visible(found, calendars, ctx);
  // The closest to today first, then shown in date order (RF-9).
  const now = ctx.now.getTime();
  const nearest = [...matches]
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a.startsAt) - now) -
        Math.abs(Date.parse(b.startsAt) - now),
    )
    .slice(0, MAX_SEARCH_RESULTS)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return {
    total: matches.length,
    events: serialize(nearest, calendars, ctx),
  };
}

async function findFreeTime(args: unknown, ctx: ToolContext) {
  const parsed = freeTimeArgsSchema.safeParse(args);
  if (!parsed.success) return { status: "invalid_arguments" };
  const period = parsePeriod(
    parsed.data.from,
    parsed.data.to,
    ctx.timeZone,
    MAX_FREE_DAYS,
  );
  if (period.status !== "ok") return { status: period.status };

  const { data: people, error } = await ctx.supabase.rpc("assistant_people");
  if (error) throw error;
  const others = (people ?? [])
    .filter((person) => person.user_id !== ctx.userId)
    .map((person) => ({
      id: person.user_id,
      name: person.display_name,
      consents: person.shares_availability,
    }));

  const chosen: typeof others = [];
  for (const name of parsed.data.people) {
    const match = matchPerson(name, others);
    if (match.status !== "ok") return match;
    const person = others.find((other) => other.id === match.person.id)!;
    if (!chosen.includes(person)) chosen.push(person);
  }

  // The asker is busy with every event they see (RF-10, D6).
  const mine = await getEventsInRange(ctx.supabase, period.from, period.to);
  const busy: BusyInterval[] = mine.map((event) =>
    busyFromEvent(event, ctx.timeZone),
  );

  const consenting = chosen.filter((person) => person.consents);
  const withoutConsent = chosen.filter((person) => !person.consents);

  if (consenting.length > 0) {
    const { data: rows, error: busyError } = await ctx.supabase.rpc(
      "assistant_busy",
      {
        p_person_ids: consenting.map((person) => person.id),
        p_from: period.from.toISOString(),
        p_to: period.to.toISOString(),
      },
    );
    if (busyError) throw busyError;
    const all = rows ?? [];
    const singles = all.filter((row) => row.recurrence === null);
    const series = all.filter((row) => row.recurrence !== null);
    busy.push(
      ...singles.map((row) =>
        busyFromEvent(
          { startsAt: row.starts_at, endsAt: row.ends_at, allDay: row.all_day },
          ctx.timeZone,
        ),
      ),
      ...expandRows(
        series.map((row) => ({ ...row, exdates: row.exdates ?? [] })),
        singles,
        period.from,
        period.to,
      ).map(({ row, occurrence }) =>
        busyFromEvent(
          {
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            allDay: row.all_day,
          },
          ctx.timeZone,
        ),
      ),
    );
  }

  // RF-22: without consent, a person only counts with their events the asker
  // already sees, which are already in the asker's own busy times above; their
  // private calendars are never read.

  const unconsented = withoutConsent.map((person) => person.name);
  return {
    status: "ok",
    people: chosen.map((person) => person.name),
    withoutConsent: unconsented,
    // The model sometimes left this out when it had to word it (T12).
    ...(unconsented.length
      ? {
          notice: `${listNames(unconsented)} no ${unconsented.length > 1 ? "han" : "ha"} dado permiso para consultar su disponibilidad: solo se han tenido en cuenta sus eventos que ves.`,
        }
      : {}),
    days: freeSlots(
      busy,
      period.days,
      parsed.data.ranges ?? DEFAULT_RANGES,
      ctx.timeZone,
    ).map(({ date, free }) => ({ date, weekday: weekdayName(date), free })),
  };
}

function listNames(names: string[]): string {
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`
    : (names[0] ?? "");
}

const TOOLS: Record<
  string,
  (args: unknown, ctx: ToolContext) => Promise<object>
> = {
  list_events: listEvents,
  search_events: searchEvents,
  find_free_time: findFreeTime,
};

/** Runs a tool the model asked for; bad names or arguments go back to the model. */
export async function runTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
): Promise<object> {
  const tool = TOOLS[name];
  if (!tool) return { status: "unknown_tool" };
  let args: unknown;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return { status: "invalid_arguments" };
  }
  return tool(args, ctx);
}
