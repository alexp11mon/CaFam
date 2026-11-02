/** Hours of the provisional block of a new event (spec 019 RF-36 to RF-38). */
export interface DraftRange {
  startMinute: number;
  endMinute: number;
}

const STEP = 15;
const LAST = 1439;
const quarter = (minutes: number) => Math.round(minutes / STEP) * STEP;

/** The block moved by `delta` minutes in quarters, its length kept, inside the day. */
export function moveDraft(range: DraftRange, delta: number): DraftRange {
  const length = range.endMinute - range.startMinute;
  const latest = Math.floor((LAST - length) / STEP) * STEP;
  const start = Math.min(
    Math.max(range.startMinute + quarter(delta), 0),
    latest,
  );
  return { startMinute: start, endMinute: start + length };
}

/** The block ending at `end` in quarters: at least 15 min, never past 23:59 (RF-38). */
export function resizeDraft(range: DraftRange, end: number): DraftRange {
  return {
    startMinute: range.startMinute,
    endMinute: Math.min(Math.max(quarter(end), range.startMinute + STEP), LAST),
  };
}
