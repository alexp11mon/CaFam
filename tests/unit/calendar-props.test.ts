import { describe, expect, it } from "vitest";
import { calendarProps } from "@/lib/calendar/calendar-props";
import type { CalendarRecord } from "@/lib/calendar/queries";

// Spec 034 T9: what the calendar page and the offline app share (RF-7, RF-8).
const calendar = (
  id: string,
  role: CalendarRecord["role"],
  synced: CalendarRecord["synced"] = null,
): CalendarRecord => ({
  id,
  name: id,
  description: null,
  color: "#A0C4FF",
  ownerId: "me",
  createdAt: "2026-01-01T00:00:00Z",
  role,
  synced,
});

describe("calendarProps", () => {
  it("lists the calendars that take events and the next timed events", () => {
    const props = calendarProps({
      userId: "me",
      calendars: [calendar("Casa", "owner"), calendar("Club", "viewer")],
      people: [{ id: "me", displayName: "Ana" }],
      groups: [],
      preferences: { calendarPreferences: [], personPreferences: [] },
      upcoming: [
        {
          id: "e1",
          title: "Dentista",
          startsAt: "2026-11-17T09:00:00Z",
          endsAt: "2026-11-17T10:00:00Z",
          allDay: false,
          calendarId: "Casa",
        },
        {
          id: "e2",
          title: "Fiesta",
          startsAt: "2026-11-17T00:00:00Z",
          endsAt: "2026-11-18T00:00:00Z",
          allDay: true,
          calendarId: "Casa",
        },
      ] as never,
    });

    expect(props.canCreate).toBe(true);
    expect(props.editableCalendars.map((c) => c.id)).toEqual(["Casa"]);
    expect(props.nextEvents).toEqual([
      expect.objectContaining({ id: "e1", calendarName: "Casa" }),
    ]);
    expect(props.groups[0]?.calendars.map((c) => c.id)).toEqual([
      "Casa",
      "Club",
    ]);
  });

  it("cannot create with only calendars to read", () => {
    const props = calendarProps({
      userId: "me",
      calendars: [calendar("Club", "viewer")],
      people: [],
      groups: [],
      preferences: { calendarPreferences: [], personPreferences: [] },
      upcoming: [],
    });
    expect(props.canCreate).toBe(false);
  });
});
