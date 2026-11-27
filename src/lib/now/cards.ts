import type { BusyPerson } from "@/lib/availability/queries";
import { busyBlocks, type BusyInput } from "@/lib/availability/busy";
import {
  byPosition,
  type CalendarPreference,
  type Person,
  type PersonPreference,
} from "@/lib/calendar/grouping";
import { utcDateKey } from "@/lib/calendar/time-zone";
import { nowWindow } from "./window";

// What "Ahora" says of each person at an instant (spec 054 RF-2 to RF-15,
// RF-22, plan D3, D8). Pure: the page and the offline app call it every tick.

export interface NowEventInput {
  id: string;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
}

export interface NowInput {
  userId: string;
  timeZone: string;
  calendars: readonly {
    id: string;
    name: string;
    ownerId: string | null;
    color: string;
  }[];
  people: readonly Person[];
  preferences: {
    calendarPreferences: readonly CalendarPreference[];
    personPreferences: readonly PersonPreference[];
  };
  /** Repetitions already expanded. */
  events: readonly NowEventInput[];
  /** null: no data, without connection (RF-22). */
  busy: readonly BusyInput[] | null;
  busyPeople: readonly BusyPerson[];
}

export interface NowEvent {
  id: string;
  title: string;
  calendarName: string;
  color: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
}

/** Discriminated by kind so the live region only speaks on a kind change (D8). */
export type NowState =
  | { kind: "event"; events: NowEvent[]; more: number }
  | { kind: "busy"; until: string }
  | { kind: "free"; until: string | null }
  | { kind: "noData" };

export interface NowCardData {
  /** `name` is empty when the profile is not shared: the card names it. */
  person: { id: string; name: string; isMe: boolean };
  /** Seen only through availability: no titles, no "Después" (RF-13). */
  busyOnly: boolean;
  /** All-day events of today (RF-12). */
  today: NowEvent[];
  current: NowState;
  /** null: nothing until the end of tomorrow (RF-11). */
  next: NowEvent | null;
}

const MAX_SHOWN = 2;

export function buildNowCards(input: NowInput, now: number): NowCardData[] {
  const { day, todayEnd, tomorrowEnd } = nowWindow(input.timeZone, now);
  const visibleOf = new Map(
    input.preferences.calendarPreferences.map((p) => [p.calendarId, p.visible]),
  );
  const visible = new Map(
    input.calendars
      .filter((calendar) => visibleOf.get(calendar.id) ?? true)
      .map((calendar) => [calendar.id, calendar]),
  );
  const marked = input.busyPeople.filter((person) => person.shown);

  // Followed: me, owners of visible calendars and the marked people (RF-2 to RF-5).
  const owners = new Set(
    [...visible.values()].flatMap((calendar) =>
      calendar.ownerId ? [calendar.ownerId] : [],
    ),
  );
  const names = new Map(input.people.map((p) => [p.id, p.displayName]));
  for (const person of marked) {
    if (!names.has(person.id)) names.set(person.id, person.name);
  }
  const ids = new Set([
    input.userId,
    ...owners,
    ...marked.map((person) => person.id),
  ]);
  const positions = new Map(
    input.preferences.personPreferences.map((p) => [p.personId, p.position]),
  );
  const people = [...ids]
    .map((id) => ({ id, name: names.get(id) ?? "" }))
    .sort(
      byPosition(
        (person) => positions.get(person.id),
        (a, b) =>
          a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id),
      ),
    );
  const me = people.findIndex((person) => person.id === input.userId);
  people.unshift(...people.splice(me, 1));

  const shown = input.events.filter((event) => visible.has(event.calendarId));
  const blocks =
    input.busy === null ? null : busyBlocks(input.busy, shown).timed;
  const toEvent = (event: NowEventInput): NowEvent => {
    const calendar = visible.get(event.calendarId)!;
    return {
      id: event.id,
      title: event.title,
      calendarName: calendar.name,
      color: calendar.color,
      location: event.location,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    };
  };
  const start = (item: { startsAt: string }) => Date.parse(item.startsAt);
  const end = (item: { endsAt: string }) => Date.parse(item.endsAt);
  const isOn = (item: { startsAt: string; endsAt: string }) =>
    start(item) <= now && now < end(item);

  return people.map((person) => {
    const own = shown.filter(
      (event) => visible.get(event.calendarId)!.ownerId === person.id,
    );
    const busyOnly = person.id !== input.userId && !owners.has(person.id);
    const isMarked = marked.some((m) => m.id === person.id);
    const timed = own
      .filter((event) => !event.allDay)
      .sort((a, b) => start(a) - start(b));
    const today = own
      .filter(
        (event) =>
          event.allDay &&
          utcDateKey(event.startsAt) <= day &&
          day < utcDateKey(event.endsAt),
      )
      .map(toEvent);
    const upcoming = timed.find(
      (event) =>
        start(event) >= now &&
        !isOn(event) &&
        start(event) < tomorrowEnd.getTime(),
    );
    const next = upcoming ? toEvent(upcoming) : null;

    const theirBlocks = (blocks ?? []).filter((b) => b.personId === person.id);
    const busyBlock = isMarked ? theirBlocks.find(isOn) : undefined;
    const nextBusy = isMarked
      ? theirBlocks.find((b) => start(b) > now)
      : undefined;
    // Free until the first thing that starts later today (RF-9).
    const freeUntil = () => {
      const first = [next?.startsAt, nextBusy?.startsAt]
        .filter((at): at is string => Boolean(at))
        .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      return first && Date.parse(first) < todayEnd.getTime() ? first : null;
    };

    const on = timed.filter(isOn).sort((a, b) => start(b) - start(a));
    let current: NowState;
    if (on.length > 0) {
      current = {
        kind: "event",
        events: on.slice(0, MAX_SHOWN).map(toEvent),
        more: Math.max(0, on.length - MAX_SHOWN),
      };
    } else if (busyOnly && blocks === null) {
      current = { kind: "noData" };
    } else if (busyBlock) {
      current = { kind: "busy", until: busyBlock.endsAt };
    } else {
      current = { kind: "free", until: freeUntil() };
    }

    return {
      person: { ...person, isMe: person.id === input.userId },
      busyOnly,
      today: busyOnly ? [] : today,
      current,
      next: busyOnly ? null : next,
    };
  });
}
