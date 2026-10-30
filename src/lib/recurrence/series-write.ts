import { firstOccurrence, seriesBound } from "./expand";
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
