// What the calendar screen gives CalendarClient besides the events, for the
// page with a connection and for the offline app (spec 034 RF-7, RF-8, plan
// calendar-props). Pure: no reads.
import type { CalendarRecord, CalendarEventRecord } from "./queries";
import { organizeGroups } from "./organize-groups";
import { canWriteEvents } from "@/lib/sync/read-only";

type OrganizeInput = Parameters<typeof organizeGroups>[0];

export function calendarProps({
  userId,
  calendars,
  people,
  groups: userGroups,
  preferences,
  upcoming,
}: {
  userId: string;
  calendars: CalendarRecord[];
  people: OrganizeInput["people"];
  groups: OrganizeInput["groups"];
  preferences: Omit<
    OrganizeInput,
    "currentUserId" | "people" | "groups" | "calendars"
  >;
  /** Events of the next 48 h, for "Próximo evento". */
  upcoming: readonly CalendarEventRecord[];
}) {
  const names = new Map(calendars.map((c) => [c.id, c.name]));
  const nextEvents = upcoming
    .filter((record) => !record.allDay)
    .map((record) => ({
      id: record.id,
      title: record.title,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      allDay: record.allDay,
      calendarId: record.calendarId,
      calendarName: names.get(record.calendarId) ?? "",
    }));

  // People, calendars and their saved order and visibility (spec 002 RF-42,
  // RF-45, RF-46). The user's groups come first, as in "Mis calendarios"
  // (spec 007 RF-36).
  const organized = organizeGroups({
    currentUserId: userId,
    people,
    groups: userGroups,
    calendars: calendars.map(({ id, name, ownerId, createdAt, color }) => ({
      id,
      name,
      ownerId,
      createdAt,
      color,
    })),
    ...preferences,
  });
  const groups = [
    ...organized.groups.map((section) => ({
      person: {
        id: section.group.id,
        displayName: section.group.name,
        isMe: false,
      },
      groupId: section.group.id,
      calendars: section.calendars,
    })),
    ...organized.people,
  ];

  return {
    canCreate: calendars.some(canWriteEvents),
    nextEvents,
    groups,
    editableCalendars: calendars
      .filter(canWriteEvents)
      .map(({ id, name, color }) => ({ id, name, color })),
  };
}
