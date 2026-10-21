// Groups the calendars a user can see by person, applying the saved order and
// visibility (spec 002 RF-42, RF-43, RF-45, RF-47).

export interface Person {
  id: string;
  displayName: string;
}

export interface GroupableCalendar {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface CalendarPreference {
  calendarId: string;
  visible: boolean;
  position: number | null;
}

export interface PersonPreference {
  personId: string;
  position: number | null;
}

export interface PersonGroup<T extends GroupableCalendar> {
  person: Person & { isMe: boolean };
  calendars: (T & { visible: boolean })[];
}

const UNKNOWN_PERSON = "Persona desconocida";

/** Saved positions first (ascending); anything without one goes after, ordered by `fallback`. */
function byPosition<T>(
  position: (item: T) => number | null | undefined,
  fallback: (a: T, b: T) => number,
) {
  return (a: T, b: T) => {
    const first = position(a) ?? null;
    const second = position(b) ?? null;
    if (first !== null && second !== null) return first - second;
    if (first !== null) return -1;
    if (second !== null) return 1;
    return fallback(a, b);
  };
}

export function groupByPerson<T extends GroupableCalendar>({
  currentUserId,
  people,
  calendars,
  calendarPreferences,
  personPreferences,
}: {
  currentUserId: string;
  people: readonly Person[];
  calendars: readonly T[];
  calendarPreferences: readonly CalendarPreference[];
  personPreferences: readonly PersonPreference[];
}): PersonGroup<T>[] {
  const calendarPrefs = new Map(
    calendarPreferences.map((pref) => [pref.calendarId, pref]),
  );
  const personPositions = new Map(
    personPreferences.map((pref) => [pref.personId, pref.position]),
  );

  // An owner we cannot name (profile not shared) still gets a group.
  const known = new Map(people.map((person) => [person.id, person]));
  for (const calendar of calendars) {
    if (!known.has(calendar.ownerId)) {
      known.set(calendar.ownerId, {
        id: calendar.ownerId,
        displayName: UNKNOWN_PERSON,
      });
    }
  }

  const compareCalendars = byPosition<T>(
    (calendar) => calendarPrefs.get(calendar.id)?.position,
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const comparePeople = byPosition<Person>(
    (person) => personPositions.get(person.id),
    (a, b) => {
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return (
        a.displayName.localeCompare(b.displayName, "es") ||
        a.id.localeCompare(b.id)
      );
    },
  );

  return [...known.values()].sort(comparePeople).map((person) => ({
    person: { ...person, isMe: person.id === currentUserId },
    calendars: calendars
      .filter((calendar) => calendar.ownerId === person.id)
      .sort(compareCalendars)
      .map((calendar) => ({
        ...calendar,
        visible: calendarPrefs.get(calendar.id)?.visible ?? true,
      })),
  }));
}
