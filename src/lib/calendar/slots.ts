import { clampEnd } from "./time-options";

const DAY_MINUTES = 24 * 60;
const MIN_DRAG = 15;

export interface MinuteRange {
  start: number;
  end: number;
}

const clampDay = (minute: number) => Math.min(Math.max(minute, 0), DAY_MINUTES);

/**
 * Minute of the day at `y` pixels of a day column `height` pixels tall: down
 * to the half hour on a click, to the nearest quarter while dragging
 * (spec 008 RF-20, RF-42).
 */
export function minuteAt(y: number, height: number, step: 15 | 30): number {
  const minute = clampDay((y / height) * DAY_MINUTES);
  const steps =
    step === 30 ? Math.floor(minute / step) : Math.round(minute / step);
  return clampDay(steps * step);
}

/** A click: the half hour pressed and one hour, up to 23:59 (spec 008 RF-20, RF-30). */
export function clickRange(minute: number): MinuteRange {
  const start = Math.floor(clampDay(minute) / 30) * 30;
  return { start, end: clampEnd(start + 60) };
}

/**
 * A drag inside one day, in either direction: at least 15 minutes and never
 * past 23:59 (spec 008 RF-30, RF-42, RF-43).
 */
export function dragRange(from: number, to: number): MinuteRange {
  const [low, high] = [clampDay(from), clampDay(to)].sort((a, b) => a - b) as [
    number,
    number,
  ];
  const end = clampEnd(Math.max(high, low + MIN_DRAG));
  return { start: Math.min(low, end - MIN_DRAG), end };
}
