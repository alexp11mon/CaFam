import { offsetMs } from "@/lib/calendar/time-zone";

// VTIMEZONE of an IANA zone built from Intl: the transitions from two years
// before `year` to two years after, enough for the usual clients (spec 043,
// plan "Resumen"). Pure.

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function formatOffset(ms: number): string {
  const minutes = Math.round(ms / MINUTE_MS);
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

/** Local date-time (basic format, no zone) of an instant at a given offset. */
function localStamp(utcMs: number, offset: number): string {
  return new Date(utcMs + offset)
    .toISOString()
    .slice(0, 19)
    .replace(/[-:]/g, "");
}

export function vtimezone(timeZone: string, year: number): string[] {
  const from = Date.UTC(year - 2, 0, 1);
  const to = Date.UTC(year + 3, 0, 1);
  const blocks: string[] = [];
  let previous = offsetMs(from, timeZone);

  for (let day = from + DAY_MS; day <= to; day += DAY_MS) {
    const current = offsetMs(day, timeZone);
    if (current === previous) continue;
    // The change is within the last day: find its minute.
    let low = day - DAY_MS;
    let high = day;
    while (high - low > MINUTE_MS) {
      const middle = low + Math.floor((high - low) / 2 / MINUTE_MS) * MINUTE_MS;
      if (offsetMs(middle, timeZone) === previous) low = middle;
      else high = middle;
    }
    const kind = current > previous ? "DAYLIGHT" : "STANDARD";
    blocks.push(
      `BEGIN:${kind}`,
      `TZOFFSETFROM:${formatOffset(previous)}`,
      `TZOFFSETTO:${formatOffset(current)}`,
      `DTSTART:${localStamp(high, previous)}`,
      `END:${kind}`,
    );
    previous = current;
  }

  if (blocks.length === 0) {
    blocks.push(
      "BEGIN:STANDARD",
      `TZOFFSETFROM:${formatOffset(previous)}`,
      `TZOFFSETTO:${formatOffset(previous)}`,
      "DTSTART:19700101T000000",
      "END:STANDARD",
    );
  }
  return ["BEGIN:VTIMEZONE", `TZID:${timeZone}`, ...blocks, "END:VTIMEZONE"];
}
