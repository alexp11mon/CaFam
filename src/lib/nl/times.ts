import { B, E, NUMBER, readNumber, type Scan } from "./tokenize";

// Times, ends and durations of a new event in Spanish (spec 041 RF-4, RF-5,
// RF-15). Pure. Times are "HH:MM" on the clock of the profile.

export interface TimeResult {
  start: string | null;
  end: string | null;
  durationMinutes: number | null;
  /** "a las 5" read as 17:00: the preview says so (RF-15). */
  assumedAfternoon: boolean;
}

type Meridiem = "am" | "pm" | "night" | null;

interface Clock {
  hour: number;
  minute: number;
  meridiem: Meridiem;
  /** Written like a time ("21:30", "9 y media", "9pm"), not a bare number. */
  marked: boolean;
}

const PERIOD = "(?:ma[nñ]ana|tarde|noche|madrugada)";
const CLOCK = `\\d{1,2}(?:[:.]\\d{2}|h(?: ?\\d{2})?)?(?: y (?:media|cuarto|\\d{1,2})| menos (?:cuarto|\\d{1,2}))?(?: ?(?:am|pm|a\\.m\\.|p\\.m\\.)| de la ${PERIOD})?`;
const CLOCK_PARTS = new RegExp(
  `^(\\d{1,2})(?:[:.](\\d{2})|(h)(?: ?(\\d{2}))?)?(?: y (media|cuarto|\\d{1,2})| menos (cuarto|\\d{1,2}))?(?: ?(am|pm|a\\.m\\.|p\\.m\\.)| de la (${PERIOD}))?$`,
  "u",
);
const AT = "(?:a las?|sobre las?|a eso de las?|desde las?)";

function readClock(text: string): Clock | null {
  const m = CLOCK_PARTS.exec(text.trim());
  if (!m) return null;
  let hour = Number(m[1]);
  let minute = Number(m[2] ?? m[4] ?? 0);
  if (m[5])
    minute += m[5] === "media" ? 30 : m[5] === "cuarto" ? 15 : Number(m[5]);
  if (m[6]) {
    hour -= 1;
    minute = 60 - (m[6] === "cuarto" ? 15 : Number(m[6]));
  }
  const word = m[7] ?? m[8] ?? null;
  const meridiem: Meridiem =
    word === null
      ? null
      : /^(?:am|a\.m\.|ma|madrugada)/u.test(word)
        ? "am"
        : word === "noche"
          ? "night"
          : "pm";
  if (hour < 0) hour = 23;
  if (hour > 23 || minute > 59 || minute < 0) return null;
  if (meridiem && hour > 12) return null;
  return {
    hour,
    minute,
    meridiem,
    // "21h" is a time; "1h" or "1h30" is a duration (RF-5).
    marked: Boolean(m[2] || m[5] || m[6] || word || (m[3] && hour >= 8)),
  };
}

/** The 24 h hour, and whether "5" was taken as 17:00 (RF-15). */
function toDay(clock: Clock, fallback: Meridiem = null): [number, boolean] {
  const { hour } = clock;
  const meridiem = clock.meridiem ?? fallback;
  if (meridiem === "am") return [hour === 12 ? 0 : hour, false];
  if (meridiem === "pm") return [hour < 12 ? hour + 12 : hour, false];
  if (meridiem === "night")
    return [hour === 12 ? 0 : hour >= 5 ? hour + 12 : hour, false];
  if (hour >= 1 && hour <= 7) return [hour + 12, true];
  return [hour, false];
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

function single(clock: Clock): { time: string; assumed: boolean } {
  const [hour, assumed] = toDay(clock);
  return { time: fmt(hour, clock.minute), assumed };
}

function range(
  scan: Scan,
): { start: string; end: string; assumed: boolean } | null {
  const pair = (a: string, b: string) => {
    const first = readClock(a);
    const second = readClock(b);
    if (!first || !second) return null;
    // "de 9 a 11 de la noche": the end says it for both.
    let [startHour, assumedStart] = toDay(first, second.meridiem);
    const [endHour, assumedEnd] = toDay(second);
    if (!first.meridiem && second.meridiem && startHour > endHour) {
      [startHour, assumedStart] = toDay(first);
    }
    // "de 7 a 9": a start after the end was a morning after all.
    if (assumedStart && !assumedEnd && startHour > endHour) {
      startHour -= 12;
      assumedStart = false;
    }
    return {
      start: fmt(startHour, first.minute),
      end: fmt(endHour, second.minute),
      assumed: assumedStart || assumedEnd,
    };
  };
  return (
    scan.first(
      `${B}(?:de|desde) (?:las? )?(${CLOCK}) (?:a|hasta) (?:las? )?(${CLOCK})${E}`,
      "time",
      (m) => pair(m[1]!, m[2]!),
    ) ??
    scan.first(`${B}(?:${AT} )?(${CLOCK}) ?- ?(${CLOCK})${E}`, "time", (m) =>
      pair(m[1]!, m[2]!),
    )
  );
}

function start(scan: Scan): { time: string; assumed: boolean } | null {
  const fixed = (time: string) => ({ time, assumed: false });
  return (
    scan.first(`${B}${AT} (${CLOCK})${E}`, "time", (m) => {
      const clock = readClock(m[1]!);
      return clock ? single(clock) : null;
    }) ??
    scan.first(`${B}(?:a |al )?mediodia${E}`, "time", () => fixed("12:00")) ??
    scan.first(`${B}(?:a (?:la )?)?medianoche${E}`, "time", () =>
      fixed("00:00"),
    ) ??
    scan.first(`(?<!hasta (?:las? )?)${B}(${CLOCK})${E}`, "time", (m) => {
      const clock = readClock(m[1]!);
      return clock?.marked ? single(clock) : null;
    }) ??
    scan.first(`${B}por la (ma[nñ]ana|tarde|noche)${E}`, "time", (m) =>
      fixed(
        m[1]!.startsWith("ma") ? "09:00" : m[1] === "tarde" ? "17:00" : "21:00",
      ),
    )
  );
}

function until(scan: Scan): { time: string; assumed: boolean } | null {
  return scan.first(`${B}hasta (?:las? )?(${CLOCK})${E}`, "time", (m) => {
    const clock = readClock(m[1]!);
    return clock ? single(clock) : null;
  });
}

function duration(scan: Scan): number | null {
  const amount = (raw: string) => (raw === "media" ? 0.5 : readNumber(raw));
  return (
    scan.first(
      `${B}(?:durante |por )?(${NUMBER}|media) ?(?:h|horas?)(?: ?(?:y )?(\\d{1,2}|media)(?: ?(?:min|minutos?))?)?${E}`,
      "duration",
      (m) => {
        const hours = amount(m[1]!);
        const minutes = m[2] ? (m[2] === "media" ? 30 : Number(m[2])) : 0;
        const total = Math.round(hours * 60) + minutes;
        return total > 0 && total <= 24 * 60 ? total : null;
      },
    ) ??
    scan.first(
      `${B}(?:durante |por )?(${NUMBER}) ?(?:min|minutos?)${E}`,
      "duration",
      (m) => {
        const total = readNumber(m[1]!);
        return total > 0 && total <= 24 * 60 ? total : null;
      },
    )
  );
}

/** Takes the times and the duration of the text, if any. */
export function readTimes(scan: Scan): TimeResult {
  const both = range(scan);
  if (both) {
    return {
      start: both.start,
      end: both.end,
      durationMinutes: null,
      assumedAfternoon: both.assumed,
    };
  }
  const from = start(scan);
  const to = until(scan);
  return {
    start: from?.time ?? null,
    end: to?.time ?? null,
    durationMinutes: to ? null : duration(scan),
    assumedAfternoon: Boolean(from?.assumed || to?.assumed),
  };
}
