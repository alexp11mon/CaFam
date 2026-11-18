import { whenText, type AssistantAction } from "@/lib/assistant/actions";
import {
  matchCalendar,
  type CalendarMatch,
  type MatchableCalendar,
} from "@/lib/assistant/calendar-match";
import type { Refs } from "@/lib/assistant/citations";
import { pickEvent } from "@/lib/assistant/event-pick";
import {
  createEventsArgsSchema,
  MAX_WRITES,
  type CreateEventArgs,
} from "@/lib/assistant/schemas";
import {
  findEventsByTitle,
  type CitedEvent,
  type EventLike,
} from "@/lib/assistant/tools";
import { resolveTimes, type Times } from "@/lib/assistant/write-times";
import { getMyCalendars, getViewOptions } from "@/lib/calendar/queries";
import { formatTime, zonedDateKey } from "@/lib/calendar/time-zone";
import { providerName } from "@/lib/sync/provider-labels";
import { canWriteEvents, readOnlyReason } from "@/lib/sync/read-only";
import type { ProviderName } from "@/lib/sync/providers/types";
import { createSingle, toRow, type Supabase } from "../events/event-writes";
import { updatedAtOf } from "../events/quick-writes";

// Spec 036: the write tools of the assistant (plan "assistant-writes", D1,
// D3). Not a "use server" file: nothing here is an endpoint. Everything goes
// through the user's session, so RLS decides again; the model only names
// events and calendars, and the server finds them.

export interface WriteToolsContext {
  supabase: Supabase;
  userId: string;
  timeZone: string;
  now: Date;
  /** References the answer may cite, shared with the read tools. */
  refs: Refs<CitedEvent>;
  /** The request's: nothing new is written once the user cancelled (RF-44). */
  signal?: AbortSignal;
  /** Each card as soon as it exists (plan D12). */
  onAction: (action: AssistantAction) => void;
}

interface WritableCalendar extends MatchableCalendar {
  color: string;
  provider: ProviderName | null;
}

type ToolAnswer = Record<string, unknown> & { status: string };

export const WRITE_TEXTS = {
  tooMany: `Puedo crear o cambiar como mucho ${MAX_WRITES} eventos por mensaje: no he hecho ninguno. Pídemelos en varios mensajes.`,
  noWritable: "No tienes ningún calendario en el que puedas crear eventos.",
} as const;

const list = (names: readonly string[]) => names.join(", ");

/** RF-23: why the user cannot write in that calendar, and where they can. */
function readOnlyText(
  verb: "crear" | "mover",
  calendar: WritableCalendar,
  options: readonly string[],
): string {
  const name = calendar.provider ? providerName(calendar.provider) : "";
  const why =
    calendar.reason === "provider"
      ? `la cuenta de ${name} solo puede verlo`
      : calendar.reason === "reconnect"
        ? `hay que volver a conectar su cuenta de ${name}`
        : "solo puedes verlo";
  const head =
    verb === "crear"
      ? `No puedes crear eventos en «${calendar.name}»`
      : `No puedes mover eventos a «${calendar.name}»`;
  return `${head}: ${why}. Puedes crear eventos en: ${list(options)}.`;
}

/** What the model hears when the calendar is not settled (RF-20 to RF-23). */
export function calendarProblem(
  match: CalendarMatch<WritableCalendar>,
  calendars: readonly WritableCalendar[],
  verb: "crear" | "mover",
): ToolAnswer | null {
  switch (match.status) {
    case "ok":
      return null;
    case "ambiguous":
      return { status: "ambiguous_calendar", options: match.options };
    case "need_calendar":
      return { status: "need_calendar", options: match.options };
    case "not_found":
      return {
        status: "calendar_not_found",
        name: match.name,
        options: match.options,
      };
    case "no_writable":
      return { status: "no_writable", notice: WRITE_TEXTS.noWritable };
    case "read_only": {
      const calendar = calendars.find((c) => c.name === match.name)!;
      return {
        status: "read_only",
        notice: readOnlyText(verb, calendar, match.options),
      };
    }
  }
}

/** "PIAE, jueves 19 de noviembre, de 12:00 a 13:30": an option to choose. */
export const optionText = (event: EventLike, timeZone: string) =>
  `${event.title}, ${whenText(event, timeZone)}`;

/** The hours of an event in the model's terms, never ids (spec 015 D5). */
function modelTimes(times: Times, timeZone: string) {
  return times.allDay
    ? { date: times.startsAt.slice(0, 10), allDay: true }
    : {
        date: zonedDateKey(times.startsAt, timeZone),
        start: formatTime(times.startsAt, timeZone),
        end: formatTime(times.endsAt, timeZone),
      };
}

export function writeTools(ctx: WriteToolsContext) {
  // At most MAX_WRITES writes per question, created and proposed (RF-41, D3).
  let used = 0;
  let calendars: Promise<WritableCalendar[]> | null = null;
  let defaultMinutes: Promise<number> | null = null;

  const loadCalendars = () =>
    (calendars ??= getMyCalendars(ctx.supabase, ctx.userId).then((all) =>
      all.map((calendar) => ({
        id: calendar.id,
        name: calendar.name,
        color: calendar.color,
        writable: canWriteEvents(calendar),
        reason:
          calendar.role === "viewer"
            ? "viewer"
            : readOnlyReason(calendar.synced),
        provider: calendar.synced?.provider ?? null,
      })),
    ));
  const loadDefault = () =>
    (defaultMinutes ??= getViewOptions(ctx.supabase, ctx.userId).then(
      (options) => options.duration,
    ));

  /** RF-41: reserved before anything is awaited, so parallel calls count too. */
  function reserve(count: number): boolean {
    if (count > MAX_WRITES || used + count > MAX_WRITES) return false;
    used += count;
    return true;
  }

  /** RF-12 to RF-16: the event "PIAE" stands for, or what to ask. */
  async function anchorOf(
    title: string,
    date: string | null,
  ): Promise<
    { ok: true; event: EventLike } | { ok: false; answer: ToolAnswer }
  > {
    const found = await findEventsByTitle(
      ctx.supabase,
      title,
      ctx.now,
      ctx.timeZone,
    );
    const pick = pickEvent(found, {
      query: title,
      date,
      now: ctx.now,
      timeZone: ctx.timeZone,
    });
    if (pick.status === "ok") return { ok: true, event: pick.event };
    if (pick.status === "ambiguous") {
      return {
        ok: false,
        answer: {
          status: "ambiguous_event",
          title,
          options: pick.options.map((event) => optionText(event, ctx.timeZone)),
        },
      };
    }
    return { ok: false, answer: { status: "event_not_found", title } };
  }

  async function createOne(input: CreateEventArgs): Promise<ToolAnswer> {
    if (ctx.signal?.aborted) return { status: "cancelled" };
    const all = await loadCalendars();
    const match = matchCalendar(input.calendar, all);
    const problem = calendarProblem(match, all, "crear");
    if (problem || match.status !== "ok") return problem!;
    const calendar = match.calendar;

    const anchorDay = input.anchorDate ?? input.date ?? null;
    let after: EventLike | undefined;
    let before: EventLike | undefined;
    if (input.after) {
      const found = await anchorOf(input.after, anchorDay);
      if (!found.ok) return found.answer;
      after = found.event;
    }
    if (input.before) {
      const found = await anchorOf(input.before, anchorDay);
      if (!found.ok) return found.answer;
      before = found.event;
    }
    const times = resolveTimes(input, {
      timeZone: ctx.timeZone,
      defaultMinutes: await loadDefault(),
      after,
      before,
    });
    if (times.status === "end_before_start") {
      return {
        status: times.status,
        notice: `La hora de fin (${times.end}) no es posterior a la de inicio (${times.start}): no he creado «${input.title}».`,
      };
    }
    if (times.status !== "ok") return { status: times.status };

    // RF-44: the last moment to stop before writing.
    if (ctx.signal?.aborted) return { status: "cancelled" };
    const created = await createSingle(
      ctx.supabase,
      ctx.userId,
      toRow({
        title: input.title,
        calendarId: calendar.id,
        description: input.description || null,
        location: input.location || null,
        color: null,
        categoryId: null,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        allDay: times.allDay,
      }),
    );
    if (!created.ok) {
      // RF-42: never said to be done; the server makes sure it is told.
      return {
        status: "failed",
        notice: `No he podido crear «${input.title}»: ${created.error}`,
      };
    }

    const event = {
      id: created.id,
      title: input.title,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      allDay: times.allDay,
      calendarName: calendar.name,
      color: calendar.color,
      location: input.location || null,
    };
    const ref = ctx.refs.add({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      calendarName: event.calendarName,
      color: event.color,
    });
    const anchor = after ?? before;
    ctx.onAction({
      kind: "created",
      key: crypto.randomUUID(),
      event,
      ...(anchor
        ? {
            anchor: {
              title: anchor.title,
              startsAt: anchor.startsAt,
              endsAt: anchor.endsAt,
              allDay: anchor.allDay,
            },
          }
        : {}),
      undo: {
        kind: "uncreate",
        id: created.id,
        updatedAt: await updatedAtOf(ctx.supabase, created.id),
      },
    });
    return {
      status: "created",
      ref,
      title: event.title,
      ...modelTimes(times, ctx.timeZone),
      calendar: calendar.name,
      // RF-17: the answer says which event it was placed against.
      ...(anchor
        ? {
            anchor: {
              title: anchor.title,
              ...modelTimes(anchor, ctx.timeZone),
            },
          }
        : {}),
    };
  }

  return {
    /** RF-1 to RF-23: creates 1 to 3 events right away. */
    async create_events(args: unknown): Promise<ToolAnswer> {
      const raw =
        args && typeof args === "object" && "events" in args
          ? args.events
          : null;
      if (Array.isArray(raw) && raw.length > MAX_WRITES) {
        return { status: "too_many", notice: WRITE_TEXTS.tooMany };
      }
      const parsed = createEventsArgsSchema.safeParse(args);
      if (!parsed.success) return { status: "invalid_arguments" };
      if (!reserve(parsed.data.events.length)) {
        return { status: "too_many", notice: WRITE_TEXTS.tooMany };
      }
      // One by one, in order: the cards follow what was asked (D6).
      const results: ToolAnswer[] = [];
      for (const input of parsed.data.events) {
        results.push(await createOne(input));
      }
      return results.length === 1 ? results[0]! : { status: "done", results };
    },
  };
}
