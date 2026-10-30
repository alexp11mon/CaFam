import { utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";
import { RECURRENCE_MESSAGES } from "./error-messages";
import { firstOccurrence, seriesBound, truncateBefore } from "./expand";
import { resolveRepeat } from "./presets";
import { toRRule, type RecurrenceRule } from "./rule";

// What a new series stores (plan "series-actions", D5). Server only: it
// expands the rule with ical.js.

export interface SeriesTimes {
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export interface SeriesColumns {
  starts_at: string;
  ends_at: string;
  recurrence: string;
  recurrence_tz: string | null;
  recurrence_until: string | null;
}

/**
 * The series starts at its first occurrence (a Wednesday with "every Monday"
 * starts next Monday), keeps the creator's wall clock (RF-12) and knows when it
 * ends; null when the rule gives no occurrence (RF-8).
 */
export function seriesColumns(
  times: SeriesTimes,
  rule: RecurrenceRule,
  timeZone: string,
): SeriesColumns | null {
  const recurrence = toRRule(rule, times.allDay);
  const recurrenceTz = times.allDay ? null : timeZone;
  const input = { ...times, recurrence, recurrenceTz };
  const first = firstOccurrence(input);
  if (!first) return null;
  return {
    starts_at: first.startsAt,
    ends_at: first.endsAt,
    recurrence,
    recurrence_tz: recurrenceTz,
    recurrence_until: seriesBound({
      ...input,
      startsAt: first.startsAt,
      endsAt: first.endsAt,
    }),
  };
}

export type SeriesScope = "this" | "following" | "all";

export const SERIES_SCOPES: readonly SeriesScope[] = [
  "this",
  "following",
  "all",
];

/** The columns of the form, as `toRow` in the event actions. */
export interface EventRowFields {
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string | null;
  category_id: string | null;
}

export interface SeriesChangeInput {
  series: {
    id: string;
    recurrence: string;
    recurrenceTz: string | null;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
    originalStart: string;
  };
  /** The occurrence as it was before the change. */
  occurrence: {
    calendarId: string;
    startsAt: string;
    endsAt: string;
    allDay: boolean;
  };
  row: EventRowFields;
  /** "Repetir" as the form sends it. */
  repeat: string;
  startDate: string;
  scope: SeriesScope;
  /** The editor's profile zone, for a series that gets one. */
  timeZone: string;
}

/** What `series_loss` must count before saving; null when nothing is lost. */
export type LossQuery = { from?: string; only?: string } | null;

export type SeriesChangePlan =
  | { kind: "error"; field?: "repeat"; message: string }
  | {
      kind: "rpc";
      fn: "update_occurrence" | "split_series" | "update_series";
      args: Record<string, unknown>;
      loss: LossQuery;
    };

const SINGLE = {
  recurrence: null,
  recurrence_tz: null,
  recurrence_until: null,
};

function shifted(instant: string, ms: number): string {
  return new Date(Date.parse(instant) + ms).toISOString();
}

/**
 * The function and arguments of a change to an occurrence (plan "Flujo" 3,
 * D8, D10 to D12). Pure apart from ical.js: the action asks series_loss and
 * calls it.
 */
export function planSeriesChange(input: SeriesChangeInput): SeriesChangePlan {
  const { series, occurrence, row, scope } = input;
  const resolved = resolveRepeat(input.repeat, input.startDate);
  if (!resolved.ok) {
    return {
      kind: "error",
      field: "repeat",
      message: RECURRENCE_MESSAGES.invalid,
    };
  }
  const rule = resolved.rule;
  const recurrence = rule ? toRRule(rule, row.all_day) : null;
  const ruleChanged =
    recurrence !== series.recurrence || row.all_day !== series.allDay;
  const delta = Date.parse(row.starts_at) - Date.parse(occurrence.startsAt);
  const occurrenceDate = occurrence.allDay
    ? utcDateKey(occurrence.startsAt)
    : zonedDateKey(occurrence.startsAt, input.timeZone);
  const dateChanged = input.startDate !== occurrenceDate;
  const zone = series.recurrenceTz ?? input.timeZone;

  if (scope === "this") {
    if (row.calendar_id !== occurrence.calendarId) {
      return { kind: "error", message: RECURRENCE_MESSAGES.calendarThis };
    }
    if (ruleChanged)
      return { kind: "error", message: RECURRENCE_MESSAGES.ruleThis };
    // An exception stays in the calendar of its series (D10).
    const fields: Partial<EventRowFields> = { ...row };
    delete fields.calendar_id;
    return {
      kind: "rpc",
      fn: "update_occurrence",
      args: {
        p_series_id: series.id,
        p_original_start: series.originalStart,
        p_fields: fields,
      },
      loss: null,
    };
  }

  const duration = Date.parse(row.ends_at) - Date.parse(row.starts_at);
  const empty = {
    kind: "error",
    field: "repeat",
    message: RECURRENCE_MESSAGES.empty,
  } as const;

  if (scope === "following") {
    const truncated = truncateBefore(
      {
        startsAt: series.startsAt,
        endsAt: series.endsAt,
        allDay: series.allDay,
        recurrence: series.recurrence,
        recurrenceTz: series.recurrenceTz,
      },
      series.originalStart,
    );
    // Nothing before it: "Este y los siguientes" is the whole series.
    if (truncated.recurrence) {
      const newRule =
        rule && !ruleChanged ? { ...rule, end: truncated.remaining } : rule;
      const columns = newRule
        ? seriesColumns(
            {
              startsAt: row.starts_at,
              endsAt: row.ends_at,
              allDay: row.all_day,
            },
            newRule,
            zone,
          )
        : SINGLE;
      if (!columns) return empty;
      const keep = !ruleChanged && delta === 0;
      return {
        kind: "rpc",
        fn: "split_series",
        args: {
          p_series_id: series.id,
          p_original_start: series.originalStart,
          p_old_recurrence: truncated.recurrence,
          p_old_until: truncated.until,
          p_new: { ...row, ...columns },
          p_keep_exceptions: keep,
        },
        loss: keep ? null : { from: series.originalStart },
      };
    }
  }

  // "Todos los eventos": the first occurrence moves as this one did.
  const startsAt = shifted(series.startsAt, delta);
  const times = {
    starts_at: startsAt,
    ends_at: shifted(startsAt, duration),
  };
  if (!rule) {
    return {
      kind: "rpc",
      fn: "update_series",
      args: {
        p_series_id: series.id,
        p_fields: { ...row, ...times, ...SINGLE },
        p_shift: null,
        p_drop_exceptions: true,
      },
      // The first occurrence stays as the single event (plan D7).
      loss: { from: shifted(series.startsAt, 1000) },
    };
  }
  const columns = seriesColumns(
    { startsAt: times.starts_at, endsAt: times.ends_at, allDay: row.all_day },
    rule,
    zone,
  );
  if (!columns) return empty;
  const drop = ruleChanged || dateChanged;
  return {
    kind: "rpc",
    fn: "update_series",
    args: {
      p_series_id: series.id,
      p_fields: { ...row, ...columns },
      p_shift: drop || delta === 0 ? null : `${delta / 1000} seconds`,
      p_drop_exceptions: drop,
    },
    loss: drop ? {} : null,
  };
}

/** Arguments of delete_occurrences and what it would lose (RF-20, RF-24b). */
export function planSeriesDelete(
  series: SeriesChangeInput["series"],
  scope: SeriesScope,
): {
  args: Record<string, unknown>;
  loss: { from?: string; only?: string };
} {
  const base = {
    p_series_id: series.id,
    p_original_start: series.originalStart,
    p_scope: scope,
    p_recurrence: null as string | null,
    p_until: null as string | null,
  };
  if (scope === "this") {
    return { args: base, loss: { only: series.originalStart } };
  }
  if (scope === "following") {
    const truncated = truncateBefore(
      {
        startsAt: series.startsAt,
        endsAt: series.endsAt,
        allDay: series.allDay,
        recurrence: series.recurrence,
        recurrenceTz: series.recurrenceTz,
      },
      series.originalStart,
    );
    // Nothing before it: delete_occurrences deletes the series.
    if (truncated.recurrence) {
      return {
        args: {
          ...base,
          p_recurrence: truncated.recurrence,
          p_until: truncated.until,
        },
        loss: { from: series.originalStart },
      };
    }
  }
  return { args: base, loss: {} };
}
