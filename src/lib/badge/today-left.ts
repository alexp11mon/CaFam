interface BadgeEvent {
  calendarId: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

/**
 * Timed events of visible calendars still to finish today (spec 047 RF-12):
 * they end after `now` and start before the end of the day.
 */
export function todayLeft(
  events: readonly BadgeEvent[],
  hidden: ReadonlySet<string>,
  now: Date,
  dayEnd: Date,
): number {
  return events.filter(
    (event) =>
      !event.allDay &&
      !hidden.has(event.calendarId) &&
      Date.parse(event.endsAt) > now.getTime() &&
      Date.parse(event.startsAt) < dayEnd.getTime(),
  ).length;
}
