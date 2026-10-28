import {
  byPosition,
  groupByPerson,
  type CalendarPreference,
  type GroupableCalendar,
  type Person,
  type PersonGroup,
  type PersonPreference,
} from "./grouping";

// The user's own groups first, then the calendars without group by person as
// before (spec 007 RF-36, RF-37, RF-40, RF-42, RF-46, plan D13, D14).

export interface CalendarGroup {
  id: string;
  name: string;
  position: number | null;
}

/** Not stored: computed from the calendars' own visibility (plan D14). */
export type GroupVisibility = "shown" | "hidden" | "partial";

export interface GroupSection<T extends GroupableCalendar> {
  group: CalendarGroup;
  visibility: GroupVisibility;
  /** `orphan` marks a calendar without owner shown in the group (RF-46). */
  calendars: (T & { visible: boolean; orphan: boolean })[];
}

function visibilityOf(calendars: { visible: boolean }[]): GroupVisibility {
  const shown = calendars.filter((calendar) => calendar.visible).length;
  if (shown === calendars.length) return "shown";
  return shown === 0 ? "hidden" : "partial";
}

export function organizeGroups<T extends GroupableCalendar>({
  groups,
  calendars,
  calendarPreferences,
  ...rest
}: {
  currentUserId: string;
  people: readonly Person[];
  groups: readonly CalendarGroup[];
  calendars: readonly T[];
  calendarPreferences: readonly CalendarPreference[];
  personPreferences: readonly PersonPreference[];
}): { groups: GroupSection<T>[]; people: PersonGroup<T>[] } {
  const prefs = new Map(calendarPreferences.map((p) => [p.calendarId, p]));
  const groupIds = new Set(groups.map((group) => group.id));
  // An assignment to a group not in the list is treated as no group.
  const groupOf = (calendar: T) => {
    const id = prefs.get(calendar.id)?.groupId;
    return id && groupIds.has(id) ? id : null;
  };

  const compareCalendars = byPosition<T>(
    (calendar) => prefs.get(calendar.id)?.position,
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  const compareGroups = byPosition<CalendarGroup>(
    (group) => group.position,
    (a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id),
  );

  const sections = [...groups].sort(compareGroups).map((group) => {
    const members = calendars
      .filter((calendar) => groupOf(calendar) === group.id)
      .sort(compareCalendars)
      .map((calendar) => ({
        ...calendar,
        visible: prefs.get(calendar.id)?.visible ?? true,
        orphan: calendar.ownerId === null,
      }));
    return { group, visibility: visibilityOf(members), calendars: members };
  });

  return {
    groups: sections,
    people: groupByPerson({
      ...rest,
      calendars: calendars.filter((calendar) => groupOf(calendar) === null),
      calendarPreferences,
    }),
  };
}
