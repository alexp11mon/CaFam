export interface TimeOption {
  value: string;
  label: string;
}

const STEP = 30;
const LAST_MINUTE = 23 * 60 + 59;
const DAY_OPTIONS = 48;

export const toMinutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** An end never passes the last minute of its day (spec 008 RF-30). */
export const clampEnd = (minutes: number) => Math.min(minutes, LAST_MINUTE);

/** "30 min", "1 h", "2 h 30 min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * A typed time as HH:MM, or null: accepts "9", "9:05", "905", "0905" and
 * "09:05" (spec 008 RF-16).
 */
export function normalizeTime(input: string): string | null {
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(input.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  if (hours > 23 || minutes > 59) return null;
  return fromMinutes(hours * 60 + minutes);
}

/** 00:00 to 23:30 every 30 minutes (spec 008 RF-13). */
export function startOptions(): TimeOption[] {
  return Array.from({ length: DAY_OPTIONS }, (_, index) => {
    const value = fromMinutes(index * STEP);
    return { value, label: value };
  });
}

/**
 * End times after `start`, every 30 minutes, with the resulting duration
 * (spec 008 RF-49). When the day has no room left, only 23:59.
 */
export function endOptions(start: string): TimeOption[] {
  const from = normalizeTime(start);
  if (!from) return startOptions();
  const begin = toMinutes(from);
  const options: TimeOption[] = [];
  for (let end = begin + STEP; end <= LAST_MINUTE; end += STEP) {
    options.push({
      value: fromMinutes(end),
      label: `${fromMinutes(end)} (${formatDuration(end - begin)})`,
    });
  }
  if (options.length === 0 && begin < LAST_MINUTE) {
    options.push({
      value: fromMinutes(LAST_MINUTE),
      label: `${fromMinutes(LAST_MINUTE)} (${formatDuration(LAST_MINUTE - begin)})`,
    });
  }
  return options;
}

/**
 * The end after the start moved from `oldStart` to `newStart`, keeping the
 * duration (one hour if the old times are not valid), never past the day
 * (spec 008 RF-17, RF-30).
 */
export function shiftEnd(
  oldStart: string,
  newStart: string,
  end: string,
): string {
  const start = normalizeTime(newStart);
  if (!start) return end;
  const before = normalizeTime(oldStart);
  const after = normalizeTime(end);
  const duration =
    before && after && toMinutes(after) > toMinutes(before)
      ? toMinutes(after) - toMinutes(before)
      : 60;
  return fromMinutes(clampEnd(toMinutes(start) + duration));
}
