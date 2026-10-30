// Pure layout of one week of the month view in lanes, so a multi-day event is
// one continuous block (spec 016 RF-34..RF-36, plan D6, D7).
import { eventDayKeys, isBanner, type LayoutEventInput } from "./layout";

export interface MonthLaneItem<T extends LayoutEventInput> {
  event: T;
  /** Column of the first day in the week, 0 (Monday) to 6. */
  start: number;
  /** Days it covers in this week, 1 to 7. */
  span: number;
  lane: number;
}

/** Each event of the week in the first lane free on all its days: multi-day first, then by start. */
export function layoutMonthWeek<T extends LayoutEventInput>(
  events: readonly T[],
  weekDays: readonly string[],
  timeZone: string,
): MonthLaneItem<T>[] {
  const placed = events.flatMap((event) => {
    const columns = eventDayKeys(event, timeZone)
      .map((key) => weekDays.indexOf(key))
      .filter((column) => column !== -1);
    if (columns.length === 0) return [];
    const start = Math.min(...columns);
    return [
      {
        event,
        start,
        span: Math.max(...columns) - start + 1,
        banner: isBanner(event, timeZone),
      },
    ];
  });

  placed.sort(
    (a, b) =>
      Number(b.banner || b.span > 1) - Number(a.banner || a.span > 1) ||
      a.start - b.start ||
      Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
      b.span - a.span ||
      a.event.id.localeCompare(b.event.id),
  );

  const lanes: boolean[][] = [];
  return placed.map(({ event, start, span }) => {
    const days = Array.from({ length: span }, (_, i) => start + i);
    let lane = lanes.findIndex((used) => days.every((day) => !used[day]));
    if (lane === -1) lane = lanes.push([]) - 1;
    for (const day of days) lanes[lane]![day] = true;
    return { event, start, span, lane };
  });
}

const covers = (item: { start: number; span: number }, day: number) =>
  day >= item.start && day < item.start + item.span;

/**
 * What fits in `maxLanes` lines per day. A day that does not fit keeps its last
 * line for "+N"; an item is shown only if it fits on every day it covers.
 */
export function fitWeek<T extends LayoutEventInput>(
  items: readonly MonthLaneItem<T>[],
  maxLanes: number,
): { visible: MonthLaneItem<T>[]; hidden: number[] } {
  const days = [0, 1, 2, 3, 4, 5, 6];
  const limits = days.map(() => maxLanes);
  const visibleOf = () =>
    items.filter((item) =>
      days.every((day) => !covers(item, day) || item.lane < limits[day]!),
    );

  // Hiding an item can make another day need its "+N" line: repeat until stable.
  for (;;) {
    const visible = visibleOf();
    const hidden = days.map(
      (day) =>
        items.filter((i) => covers(i, day)).length -
        visible.filter((i) => covers(i, day)).length,
    );
    const next = days.map((day) =>
      hidden[day]! > 0
        ? Math.min(limits[day]!, Math.max(0, maxLanes - 1))
        : limits[day]!,
    );
    if (next.every((limit, day) => limit === limits[day])) {
      return { visible, hidden };
    }
    next.forEach((limit, day) => (limits[day] = limit));
  }
}
