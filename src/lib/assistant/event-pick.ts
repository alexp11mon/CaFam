import { addDays, utcDateKey, zonedDateKey } from "@/lib/calendar/time-zone";

// Spec 036, RF-12 to RF-15 and RF-24: which event the user means by its
// title ("PIAE", "el PIAE del jueves"). Decided by the server, never by the
// model (plan D1). Pure.

export interface PickCandidate {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
}

export type EventPick<T extends PickCandidate> =
  | { status: "ok"; event: T }
  | { status: "ambiguous"; options: T[] }
  | { status: "not_found" };

export interface PickOptions {
  query: string;
  /** The day the user said, YYYY-MM-DD in their zone; null when none. */
  date: string | null;
  now: Date;
  timeZone: string;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** First and last local day of an event; all-day ones by UTC date (spec 002 D6). */
function days(event: PickCandidate, timeZone: string): [string, string] {
  if (event.allDay) {
    const first = utcDateKey(event.startsAt);
    const last = addDays(utcDateKey(event.endsAt), -1);
    return [first, last < first ? first : last];
  }
  const first = zonedDateKey(event.startsAt, timeZone);
  // An end at midnight belongs to the day before.
  const last = zonedDateKey(Date.parse(event.endsAt) - 1, timeZone);
  return [first, last < first ? first : last];
}

const byStart = <T extends PickCandidate>(a: T, b: T) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt);

function oneOf<T extends PickCandidate>(found: T[]): EventPick<T> {
  if (found.length === 0) return { status: "not_found" };
  if (found.length === 1) return { status: "ok", event: found[0]! };
  return { status: "ambiguous", options: [...found].sort(byStart) };
}

export function pickEvent<T extends PickCandidate>(
  candidates: readonly T[],
  { query, date, now, timeZone }: PickOptions,
): EventPick<T> {
  const wanted = normalize(query);
  if (!wanted) return { status: "not_found" };
  const exact = candidates.filter((event) => normalize(event.title) === wanted);
  const pool =
    exact.length > 0
      ? exact
      : candidates.filter((event) => normalize(event.title).includes(wanted));

  // RF-13: the one of the day the user said.
  if (date) {
    return oneOf(
      pool.filter((event) => {
        const [first, last] = days(event, timeZone);
        return first <= date && date <= last;
      }),
    );
  }

  // RF-14: the next one that has not ended, counting from now.
  const ahead = pool
    .filter((event) => Date.parse(event.endsAt) > now.getTime())
    .sort(byStart);
  if (ahead.length > 0) {
    const day = days(ahead[0]!, timeZone)[0];
    // RF-15: two of them that day, and the user did not say which.
    return oneOf(ahead.filter((event) => days(event, timeZone)[0] === day));
  }
  // None ahead: the latest one, so "cambia la cena" still finds yesterday's.
  const past = [...pool].sort(byStart).reverse();
  if (past.length === 0) return { status: "not_found" };
  const day = days(past[0]!, timeZone)[0];
  return oneOf(past.filter((event) => days(event, timeZone)[0] === day));
}
