// The occurrences of a series changed without a connection, as they will be
// (spec 035 RF-11, RF-12, plan D2). It plans the change with the same
// functions as the server and expands the rule with ical.js, so it is loaded
// with import() only when a series change is pending: never in the first
// JavaScript of the app (plan R5).
import type { DayRange } from "@/lib/calendar/event-window";
import type { EventData } from "@/lib/calendar/schemas";
import { utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";
import { occurrenceId, parseEventId } from "@/lib/recurrence/occurrence-id";
import { resolveRepeat } from "@/lib/recurrence/presets";
import { expandRows, type SeriesRow } from "@/lib/recurrence/read-series";
import { fromRRule } from "@/lib/recurrence/rule";
import {
  planSeriesChange,
  planSeriesDelete,
  seriesColumns,
  type EventRowFields,
  type LossQuery,
  type SeriesChangeInput,
} from "@/lib/recurrence/series-write";
import { summarizeRule } from "@/lib/recurrence/summary";
import type { OfflineChange, OutboxEntry } from "./outbox";
import type { PendingEvent } from "./overlay";
import type { OfflineException, OfflineSeries } from "./snapshot";

export interface SeriesCopy {
  /** The events with the single changes already applied (`pendingEvents`). */
  events: readonly PendingEvent[];
  series: readonly OfflineSeries[];
  exceptions: readonly OfflineException[];
  range: DayRange;
  /** The profile's zone: a new series keeps its wall clock (spec 013 RF-12). */
  timeZone: string;
}

interface State {
  events: Map<string, PendingEvent>;
  series: Map<string, OfflineSeries>;
  exceptions: Map<string, OfflineException>;
  /** Series to expand again, marked as pending. */
  touched: Set<string>;
}

const DAY_MS = 86_400_000;
const NO_TOTALS = { exceptions: 0, images: 0, comments: 0, latest: null };

function dateKeyOf(instant: string, allDay: boolean, zone: string): string {
  return allDay ? utcDateKey(instant) : zonedDateKey(instant, zone);
}

function rowFields(
  data: EventData,
  description: string | null,
): EventRowFields {
  return {
    calendar_id: data.calendarId,
    title: data.title,
    description:
      data.description === undefined ? description : data.description,
    location: data.location,
    starts_at: data.startsAt,
    ends_at: data.endsAt,
    all_day: data.allDay,
    color: data.color,
    category_id: data.categoryId,
  };
}

/** A series row of the copy from what the plan writes. */
function seriesFrom(
  id: string,
  row: Partial<EventRowFields> & Record<string, unknown>,
  before: OfflineSeries | null,
): OfflineSeries {
  const pick = <T>(key: string, fallback: T): T =>
    key in row ? (row[key] as T) : fallback;
  return {
    id,
    calendarId: pick("calendar_id", before?.calendarId ?? ""),
    title: pick("title", before?.title ?? ""),
    description: pick("description", before?.description ?? null),
    location: pick("location", before?.location ?? null),
    color: pick("color", before?.color ?? null),
    categoryId: pick("category_id", before?.categoryId ?? null),
    startsAt: pick("starts_at", before?.startsAt ?? ""),
    endsAt: pick("ends_at", before?.endsAt ?? ""),
    allDay: pick("all_day", before?.allDay ?? false),
    recurrence: pick("recurrence", before?.recurrence ?? ""),
    recurrenceTz: pick("recurrence_tz", before?.recurrenceTz ?? null),
    recurrenceUntil: pick("recurrence_until", before?.recurrenceUntil ?? null),
    exdates: before?.exdates ?? [],
    totals: before?.totals ?? NO_TOTALS,
  };
}

/** The series and original start an event id of the copy stands for. */
function locate(
  state: State,
  id: string,
): { series: OfflineSeries; originalStart: string } | null {
  const parsed = parseEventId(id);
  if (parsed?.kind === "occurrence") {
    const series = state.series.get(parsed.seriesId);
    return series ? { series, originalStart: parsed.originalStart } : null;
  }
  const exception = state.exceptions.get(id);
  const series = exception && state.series.get(exception.seriesId);
  return series ? { series, originalStart: exception.originalStart } : null;
}

/** What `planSeriesChange` needs for a change made from event `id`. */
function changeInput(
  state: State,
  change: Extract<OfflineChange, { type: "series.update" }>,
  timeZone: string,
): SeriesChangeInput | null {
  const found = locate(state, change.id);
  const event = state.events.get(change.id);
  if (!found || !event) return null;
  const { series, originalStart } = found;
  return {
    series: {
      id: series.id,
      recurrence: series.recurrence,
      recurrenceTz: series.recurrenceTz,
      startsAt: series.startsAt,
      endsAt: series.endsAt,
      allDay: series.allDay,
      originalStart,
    },
    occurrence: {
      calendarId: event.calendarId,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
    },
    row: rowFields(change.data, series.description),
    repeat: change.repeat,
    startDate: dateKeyOf(change.data.startsAt, change.data.allDay, timeZone),
    scope: change.scope,
    timeZone,
  };
}

/**
 * What a pending series change would lose, for the confirmation of RF-13;
 * null when the change cannot be planned (an error the form already shows).
 */
export function seriesLossQuery(
  copy: Omit<SeriesCopy, "range">,
  change: OfflineChange,
): LossQuery | undefined {
  const state = stateOf(copy);
  if (change.type === "series.update") {
    const input = changeInput(state, change, copy.timeZone);
    if (!input) return undefined;
    const plan = planSeriesChange(input);
    return plan.kind === "rpc" ? plan.loss : undefined;
  }
  if (change.type === "series.delete") {
    const found = locate(state, change.id);
    if (!found) return undefined;
    return planSeriesDelete(
      { ...seriesKeys(found.series), originalStart: found.originalStart },
      change.scope,
    ).loss;
  }
  return null;
}

function seriesKeys(series: OfflineSeries) {
  return {
    id: series.id,
    recurrence: series.recurrence,
    recurrenceTz: series.recurrenceTz,
    startsAt: series.startsAt,
    endsAt: series.endsAt,
    allDay: series.allDay,
  };
}

function stateOf(copy: Omit<SeriesCopy, "range">): State {
  return {
    events: new Map(copy.events.map((event) => [event.id, event])),
    series: new Map(copy.series.map((series) => [series.id, series])),
    exceptions: new Map(copy.exceptions.map((e) => [e.id, e])),
    touched: new Set(),
  };
}

/** Drop the exceptions of a series that `keep` refuses, with their events. */
function dropExceptions(
  state: State,
  seriesId: string,
  drop: (exception: OfflineException) => boolean,
) {
  for (const exception of [...state.exceptions.values()]) {
    if (exception.seriesId === seriesId && drop(exception)) {
      state.exceptions.delete(exception.id);
      state.events.delete(exception.id);
    }
  }
}

function removeSeries(state: State, seriesId: string) {
  state.series.delete(seriesId);
  state.touched.add(seriesId);
  dropExceptions(state, seriesId, () => true);
}

/** A single event that becomes a series (RF-11): create or convert. */
function makeSeries(
  state: State,
  id: string,
  data: EventData,
  repeat: string,
  timeZone: string,
) {
  const resolved = resolveRepeat(
    repeat,
    dateKeyOf(data.startsAt, data.allDay, timeZone),
  );
  if (!resolved.ok || !resolved.rule) return;
  const columns = seriesColumns(
    { startsAt: data.startsAt, endsAt: data.endsAt, allDay: data.allDay },
    resolved.rule,
    timeZone,
  );
  if (!columns) return;
  const before = state.events.get(id);
  state.events.delete(id);
  state.series.set(
    id,
    seriesFrom(
      id,
      {
        ...rowFields(data, before?.description ?? null),
        ...columns,
      },
      null,
    ),
  );
  state.touched.add(id);
}

function applyUpdate(
  state: State,
  entry: OutboxEntry,
  change: Extract<OfflineChange, { type: "series.update" }>,
  timeZone: string,
) {
  const input = changeInput(state, change, timeZone);
  if (!input) return;
  const plan = planSeriesChange(input);
  if (plan.kind !== "rpc") return;
  const seriesId = input.series.id;
  const before = state.series.get(seriesId)!;
  const args = plan.args;
  if (plan.fn === "update_occurrence") {
    const event = state.events.get(change.id);
    if (event) {
      state.events.set(change.id, {
        ...event,
        ...pendingFields(change.data, event.description),
      });
    }
    return;
  }
  state.touched.add(seriesId);
  if (plan.fn === "split_series") {
    const from = Date.parse(input.series.originalStart);
    state.series.set(seriesId, {
      ...before,
      recurrence: args.p_old_recurrence as string,
      recurrenceUntil: args.p_old_until as string | null,
    });
    // The new part has no id until the server makes it: its occurrences
    // carry the change's id and cannot be written again offline.
    const id = `pending-${entry.changeId}`;
    const created = seriesFrom(id, args.p_new as Record<string, unknown>, null);
    state.series.set(id, created);
    state.touched.add(id);
    const keep = args.p_keep_exceptions === true;
    for (const exception of [...state.exceptions.values()]) {
      if (
        exception.seriesId !== seriesId ||
        Date.parse(exception.originalStart) < from
      ) {
        continue;
      }
      if (keep) {
        state.exceptions.set(exception.id, { ...exception, seriesId: id });
      } else {
        state.exceptions.delete(exception.id);
        state.events.delete(exception.id);
      }
    }
    return;
  }
  // update_series: the whole series.
  const fields = args.p_fields as Record<string, unknown>;
  if (fields.recurrence === null) {
    // "No se repite": the first occurrence stays as a single event.
    removeSeries(state, seriesId);
    state.events.set(seriesId, {
      id: seriesId,
      calendarId: fields.calendar_id as string,
      title: fields.title as string,
      startsAt: fields.starts_at as string,
      endsAt: fields.ends_at as string,
      allDay: fields.all_day as boolean,
      color: fields.color as string | null,
      categoryId: fields.category_id as string | null,
      location: fields.location as string | null,
      description: fields.description as string | null,
      imageCount: 0,
      commentCount: 0,
      seriesId: null,
      createdBy: null,
      createdByName: null,
      seriesSummary: null,
      seriesChanged: false,
      pending: true,
    });
    return;
  }
  state.series.set(seriesId, seriesFrom(seriesId, fields, before));
  if (args.p_drop_exceptions === true) {
    dropExceptions(state, seriesId, () => true);
  } else if (typeof args.p_shift === "string") {
    const ms = Number.parseFloat(args.p_shift) * 1000;
    const shift = (instant: string) =>
      new Date(Date.parse(instant) + ms).toISOString();
    for (const exception of [...state.exceptions.values()]) {
      if (exception.seriesId !== seriesId) continue;
      state.exceptions.set(exception.id, {
        ...exception,
        originalStart: shift(exception.originalStart),
      });
      const event = state.events.get(exception.id);
      if (event) {
        state.events.set(exception.id, {
          ...event,
          startsAt: shift(event.startsAt),
          endsAt: shift(event.endsAt),
          pending: true,
        });
      }
    }
  }
}

function pendingFields(data: EventData, description: string | null) {
  return {
    title: data.title,
    calendarId: data.calendarId,
    allDay: data.allDay,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    description:
      data.description === undefined ? description : data.description,
    location: data.location,
    color: data.color,
    categoryId: data.categoryId,
    pending: true as const,
  };
}

function applyDelete(
  state: State,
  change: Extract<OfflineChange, { type: "series.delete" }>,
) {
  const found = locate(state, change.id);
  if (!found) return;
  const { series, originalStart } = found;
  const { args } = planSeriesDelete(
    { ...seriesKeys(series), originalStart },
    change.scope,
  );
  state.touched.add(series.id);
  if (change.scope === "this") {
    state.series.set(series.id, {
      ...series,
      exdates: [...series.exdates, originalStart],
    });
    dropExceptions(state, series.id, (e) => e.originalStart === originalStart);
    state.events.delete(change.id);
    return;
  }
  if (args.p_recurrence) {
    const from = Date.parse(originalStart);
    state.series.set(series.id, {
      ...series,
      recurrence: args.p_recurrence as string,
      recurrenceUntil: args.p_until as string | null,
    });
    dropExceptions(
      state,
      series.id,
      (e) => Date.parse(e.originalStart) >= from,
    );
    return;
  }
  removeSeries(state, series.id);
}

function asRow(series: OfflineSeries): SeriesRow {
  return {
    id: series.id,
    starts_at: series.startsAt,
    ends_at: series.endsAt,
    all_day: series.allDay,
    recurrence: series.recurrence,
    recurrence_tz: series.recurrenceTz,
    exdates: series.exdates,
  };
}

/**
 * The events of the copy with the pending series changes applied (RF-11,
 * RF-12): each touched series is expanded again in the range, keeping its
 * exceptions. The new occurrences are marked as pending.
 */
export function pendingSeries(
  copy: SeriesCopy,
  queue: readonly OutboxEntry[],
): PendingEvent[] {
  const state = stateOf(copy);
  for (const entry of queue) {
    const { change } = entry;
    if (change.type === "series.update") {
      applyUpdate(state, entry, change, copy.timeZone);
    } else if (change.type === "series.delete") {
      applyDelete(state, change);
    } else if (
      (change.type === "event.create" || change.type === "event.update") &&
      change.repeat &&
      change.repeat !== "none" &&
      parseEventId(change.id)?.kind !== "occurrence" &&
      !state.series.has(change.id)
    ) {
      makeSeries(state, change.id, change.data, change.repeat, copy.timeZone);
    }
  }
  if (state.touched.size === 0) return [...state.events.values()];

  // The plain occurrences of a touched series go; its exceptions stay.
  const events = [...state.events.values()].filter(
    (event) =>
      !event.seriesId ||
      !state.touched.has(event.seriesId) ||
      state.exceptions.has(event.id),
  );
  const rows = [...state.touched]
    .map((id) => state.series.get(id))
    .filter((series): series is OfflineSeries => series !== undefined);
  const keys = [...state.exceptions.values()].map((e) => ({
    series_id: e.seriesId,
    original_start: e.originalStart,
  }));
  const from = new Date(Date.parse(`${copy.range.from}T00:00:00Z`) - DAY_MS);
  const to = new Date(Date.parse(`${copy.range.to}T00:00:00Z`) + 2 * DAY_MS);
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const { row, occurrence } of expandRows(
    rows.map(asRow),
    keys,
    from,
    to,
  )) {
    const series = byId.get(row.id)!;
    const rule = fromRRule(series.recurrence);
    events.push({
      id: occurrenceId(series.id, occurrence.originalStart),
      calendarId: series.calendarId,
      title: series.title,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      allDay: series.allDay,
      color: series.color,
      categoryId: series.categoryId,
      location: series.location,
      description: series.description,
      imageCount: 0,
      commentCount: 0,
      seriesId: series.id,
      createdBy: null,
      createdByName: null,
      seriesSummary: rule ? summarizeRule(rule) : "Se repite",
      seriesChanged: false,
      pending: true,
    });
  }
  return events.sort((a, b) =>
    a.startsAt === b.startsAt
      ? a.id.localeCompare(b.id)
      : a.startsAt < b.startsAt
        ? -1
        : 1,
  );
}
