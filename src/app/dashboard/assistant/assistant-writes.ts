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
  proposeChangesArgsSchema,
  type ChangeArgs,
  type CreateEventArgs,
} from "@/lib/assistant/schemas";
import {
  findEventsByTitle,
  type CitedEvent,
  type EventLike,
} from "@/lib/assistant/tools";
import { resolveTimes, type Times } from "@/lib/assistant/write-times";
import {
  getEvent,
  getMyCalendars,
  getViewOptions,
  type CalendarRecord,
  type EventRecord,
} from "@/lib/calendar/queries";
import { planSeriesChange } from "@/lib/recurrence/series-write";
import { formatTime, zonedDateKey } from "@/lib/calendar/time-zone";
import { providerName } from "@/lib/sync/provider-labels";
import {
  canWriteEvents,
  moveTargets,
  readOnlyReason,
} from "@/lib/sync/read-only";
import type { ProviderName } from "@/lib/sync/providers/types";
import {
  createSingle,
  toRow,
  unconfirmedLoss,
  type Supabase,
} from "../events/event-writes";
import { seriesValues, updatedAtOf } from "../events/quick-writes";

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
  record: CalendarRecord;
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
        record: calendar,
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

  /** RF-28: why this event cannot be changed, or null. */
  function cannotChange(
    event: EventRecord,
    calendar: WritableCalendar | undefined,
  ): ToolAnswer | null {
    if (calendar?.writable) return null;
    const why = !calendar
      ? "ya no lo ves"
      : calendar.reason === "provider"
        ? `la cuenta de ${providerName(calendar.provider ?? "google")} solo puede ver «${calendar.name}»`
        : calendar.reason === "reconnect"
          ? `hay que volver a conectar la cuenta de «${calendar.name}»`
          : `solo puedes ver «${calendar.name}»`;
    return {
      status: "forbidden",
      notice: `No puedes cambiar «${event.title}»: ${why}.`,
    };
  }

  const cardOf = (
    event: Pick<
      EventRecord,
      "id" | "title" | "startsAt" | "endsAt" | "allDay" | "location"
    >,
    calendar: WritableCalendar,
  ) => ({
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    calendarName: calendar.name,
    color: calendar.color,
    location: event.location,
  });

  async function proposeOne(input: ChangeArgs): Promise<ToolAnswer> {
    if (ctx.signal?.aborted) return { status: "cancelled" };
    const target = await anchorOf(input.event, input.eventDate ?? null);
    if (!target.ok) return target.answer;
    const event = await getEvent(ctx.supabase, target.event.id);
    if (!event) return { status: "event_not_found", title: input.event };
    const all = await loadCalendars();
    const source = all.find((calendar) => calendar.id === event.calendarId);
    const forbidden = cannotChange(event, source);
    if (forbidden || !source) return forbidden!;

    // RF-27: only where an event of this calendar may go (spec 009, 018).
    let destination = source;
    if (input.calendar) {
      const match = matchCalendar(input.calendar, all);
      const problem = calendarProblem(match, all, "mover");
      if (problem || match.status !== "ok") return problem!;
      const allowed = moveTargets(
        source.record,
        all.map((calendar) => calendar.record),
      );
      if (!allowed.some((calendar) => calendar.id === match.calendar.id)) {
        return {
          status: "cannot_move",
          notice: `No puedo mover «${event.title}» a «${match.calendar.name}»: los eventos de una cuenta de Google o iCloud solo se mueven entre calendarios de esa cuenta, y los de CaFam entre calendarios de CaFam.`,
        };
      }
      destination = match.calendar;
    }

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
      base: event,
      after,
      before,
    });
    if (times.status === "end_before_start") {
      return {
        status: times.status,
        notice: `La hora de fin (${times.end}) no es posterior a la de inicio (${times.start}): no he preparado el cambio de «${event.title}».`,
      };
    }
    if (times.status !== "ok") return { status: times.status };

    const fields = {
      title: input.title ?? event.title,
      description:
        input.description === undefined || input.description === null
          ? event.description
          : input.description || null,
      location:
        input.location === undefined || input.location === null
          ? event.location
          : input.location || null,
      calendarId: destination.id,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      allDay: times.allDay,
    };
    const same =
      fields.title === event.title &&
      fields.description === event.description &&
      fields.location === event.location &&
      fields.calendarId === event.calendarId &&
      Date.parse(fields.startsAt) === Date.parse(event.startsAt) &&
      Date.parse(fields.endsAt) === Date.parse(event.endsAt) &&
      fields.allDay === event.allDay;
    if (same) return { status: "no_change" };

    // RF-29: an occurrence changes alone unless the user says otherwise.
    const scope = event.series ? (input.scope ?? "this") : null;
    let loss: Awaited<ReturnType<typeof unconfirmedLoss>> = null;
    if (event.series && scope) {
      const data = {
        ...fields,
        color: event.color,
        categoryId:
          fields.calendarId === event.calendarId ? event.categoryId : null,
      };
      const values = seriesValues(event, data, ctx.timeZone);
      const plan = planSeriesChange({
        series: event.series,
        occurrence: event,
        row: toRow(data),
        repeat: values.repeat,
        startDate: values.startDate,
        scope,
        timeZone: ctx.timeZone,
      });
      if (plan.kind === "error") {
        return {
          status: "failed",
          notice: `No puedo cambiar «${event.title}» así: ${plan.message}`,
        };
      }
      // RF-30: shown on the card; confirming it confirms the loss (D9).
      loss = await unconfirmedLoss(
        ctx.supabase,
        event.series.id,
        plan.loss,
        false,
      );
    }

    const updatedAt = await updatedAtOf(
      ctx.supabase,
      event.rowId ?? event.series?.id ?? event.id,
    );
    const ref = ctx.refs.add({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      calendarName: source.name,
      color: source.color,
    });
    ctx.onAction({
      kind: "change",
      key: crypto.randomUUID(),
      before: cardOf(event, source),
      after: cardOf({ ...fields, id: event.id }, destination),
      scope,
      ...(loss ? { loss } : {}),
      change: { id: event.id, scope, updatedAt, fields },
    });
    return {
      status: "proposed",
      ref,
      title: fields.title,
      before: modelTimes(event, ctx.timeZone),
      after: modelTimes(times, ctx.timeZone),
      calendar: destination.name,
    };
  }

  /** Shared by both tools: too many, malformed, or one by one in order (D3, D6). */
  async function each<T>(
    args: unknown,
    key: "events" | "changes",
    parse: (args: unknown) => { success: true; data: T[] } | { success: false },
    run: (input: T) => Promise<ToolAnswer>,
  ): Promise<ToolAnswer> {
    const raw =
      args && typeof args === "object" && key in args
        ? (args as Record<string, unknown>)[key]
        : null;
    if (Array.isArray(raw) && raw.length > MAX_WRITES) {
      return { status: "too_many", notice: WRITE_TEXTS.tooMany };
    }
    const parsed = parse(args);
    if (!parsed.success) return { status: "invalid_arguments" };
    if (!reserve(parsed.data.length)) {
      return { status: "too_many", notice: WRITE_TEXTS.tooMany };
    }
    const results: ToolAnswer[] = [];
    for (const input of parsed.data) results.push(await run(input));
    return results.length === 1 ? results[0]! : { status: "done", results };
  }

  return {
    /** RF-1 to RF-23: creates 1 to 3 events right away. */
    async create_events(args: unknown): Promise<ToolAnswer> {
      return each(
        args,
        "events",
        (value) => {
          const parsed = createEventsArgsSchema.safeParse(value);
          return parsed.success
            ? { success: true, data: parsed.data.events }
            : { success: false };
        },
        createOne,
      );
    },
    /** RF-24 to RF-30: prepares 1 to 3 changes; nothing is written (D4). */
    async propose_changes(args: unknown): Promise<ToolAnswer> {
      return each(
        args,
        "changes",
        (value) => {
          const parsed = proposeChangesArgsSchema.safeParse(value);
          return parsed.success
            ? { success: true, data: parsed.data.changes }
            : { success: false };
        },
        proposeOne,
      );
    },
  };
}
