// Groups the calendars a user can see by person, applying the saved order and
// visibility (spec 002 RF-42, RF-43, RF-45, RF-47).

export interface Person {
  id: string;
  displayName: string;
}

export interface GroupableCalendar {
  id: string;
  name: string;
  // null for a calendar without owner (spec 006 RF-21): it goes to the last group.
  ownerId: string | null;
  createdAt: string;
}

export interface CalendarPreference {
  calendarId: string;
  visible: boolean;
  position: number | null;
  /** Group of the user it is in, if any (spec 007 RF-37). */
  groupId?: string | null;
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

/**
 * Group of the calendars whose owner deleted the account (spec 006 RF-22). It is
 * not a person: always last, never reordered nor saved in person_preferences.
 */
export const ORPHAN_GROUP_ID = "orphan";
const ORPHAN_GROUP_NAME = "Sin propietario";

/** Saved positions first (ascending); anything without one goes after, ordered by `fallback`. */
export function byPosition<T>(
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
    if (calendar.ownerId !== null && !known.has(calendar.ownerId)) {
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

  const withVisibility = (owner: string | null) =>
    calendars
      .filter((calendar) => calendar.ownerId === owner)
      .sort(compareCalendars)
      .map((calendar) => ({
        ...calendar,
        visible: calendarPrefs.get(calendar.id)?.visible ?? true,
      }));

  const groups: PersonGroup<T>[] = [...known.values()]
    .sort(comparePeople)
    .map((person) => ({
      person: { ...person, isMe: person.id === currentUserId },
      calendars: withVisibility(person.id),
    }));

  const orphans = withVisibility(null);
  if (orphans.length > 0) {
    groups.push({
      person: {
        id: ORPHAN_GROUP_ID,
        displayName: ORPHAN_GROUP_NAME,
        isMe: false,
      },
      calendars: orphans,
    });
  }
  return groups;
}
