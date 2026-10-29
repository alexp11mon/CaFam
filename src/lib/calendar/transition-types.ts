// The transition types of the calendar: each one names its CSS class in
// globals.css (spec 011 RF-17..RF-19; plan view-motion, D8).
export const CAL_VIEW = "cal-view";
export const CAL_NEXT = "cal-next";
export const CAL_PREV = "cal-prev";
export const CAL_FILTER = "cal-filter";

export type PeriodType = typeof CAL_NEXT | typeof CAL_PREV;

/** The sense of a period change; none when it stays put (RF-18). */
export function periodType(delta: number): PeriodType | undefined {
  if (delta > 0) return CAL_NEXT;
  if (delta < 0) return CAL_PREV;
  return undefined;
}

/** Hoy moves towards today. ISO dates compare as strings. */
export function todayType(date: string, today: string) {
  return periodType(today.localeCompare(date));
}

/** For <ViewTransition enter/exit>: anything else (refresh, back) does not animate. */
export const VIEW_MOTION = {
  [CAL_VIEW]: CAL_VIEW,
  [CAL_NEXT]: CAL_NEXT,
  [CAL_PREV]: CAL_PREV,
  default: "none",
};

/** The transitionTypes of a Link or router.push. */
export function typesOf(type: string | undefined) {
  return type ? [type] : undefined;
}
