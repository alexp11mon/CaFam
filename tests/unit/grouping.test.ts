import { describe, expect, it } from "vitest";
import {
  groupByPerson,
  ORPHAN_GROUP_ID,
  type GroupableCalendar,
  type Person,
} from "@/lib/calendar/grouping";

const ME: Person = { id: "me", displayName: "Yo" };
const ANA: Person = { id: "ana", displayName: "Ana" };
const BEA: Person = { id: "bea", displayName: "Bea" };

function calendar(
  id: string,
  ownerId: string,
  createdAt = "2026-01-01T00:00:00Z",
): GroupableCalendar {
  return { id, ownerId, name: id, createdAt };
}

function names(groups: ReturnType<typeof groupByPerson>) {
  return groups.map((group) => ({
    person: group.person.id,
    calendars: group.calendars.map((c) => c.id),
  }));
}

describe("groupByPerson (RF-42)", () => {
  const calendars = [
    calendar("mine-2", "me", "2026-02-01T00:00:00Z"),
    calendar("mine-1", "me", "2026-01-01T00:00:00Z"),
    calendar("bea-1", "bea"),
    calendar("ana-1", "ana"),
  ];

  it("puts me first and then the others by name, with their calendars inside", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [BEA, ANA, ME],
      calendars,
      calendarPreferences: [],
      personPreferences: [],
    });

    expect(names(groups)).toEqual([
      { person: "me", calendars: ["mine-1", "mine-2"] },
      { person: "ana", calendars: ["ana-1"] },
      { person: "bea", calendars: ["bea-1"] },
    ]);
    expect(groups[0]?.person.isMe).toBe(true);
    expect(groups[1]?.person.isMe).toBe(false);
  });

  it("keeps my group even when I own no calendar", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME, ANA],
      calendars: [calendar("ana-1", "ana")],
      calendarPreferences: [],
      personPreferences: [],
    });

    expect(names(groups)).toEqual([
      { person: "me", calendars: [] },
      { person: "ana", calendars: ["ana-1"] },
    ]);
  });

  it("falls back to a placeholder person when the owner's name is unknown", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME],
      calendars: [calendar("x-1", "stranger")],
      calendarPreferences: [],
      personPreferences: [],
    });

    expect(groups.map((group) => group.person.id)).toEqual(["me", "stranger"]);
    expect(groups[1]?.person.displayName.length).toBeGreaterThan(0);
  });
});

describe("manual order (RF-45)", () => {
  const calendars = [
    calendar("mine-1", "me"),
    calendar("mine-2", "me", "2026-02-01T00:00:00Z"),
    calendar("mine-3", "me", "2026-03-01T00:00:00Z"),
    calendar("ana-1", "ana"),
  ];

  it("orders people by saved position, ahead of people without one", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME, ANA, BEA],
      calendars: [...calendars, calendar("bea-1", "bea")],
      calendarPreferences: [],
      personPreferences: [
        { personId: "ana", position: 0 },
        { personId: "me", position: 1 },
      ],
    });

    expect(groups.map((group) => group.person.id)).toEqual([
      "ana",
      "me",
      "bea",
    ]);
  });

  it("orders calendars by saved position and puts the rest last by creation date", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME, ANA],
      calendars,
      calendarPreferences: [
        { calendarId: "mine-3", visible: true, position: 0 },
        { calendarId: "mine-1", visible: true, position: 1 },
      ],
      personPreferences: [],
    });

    expect(names(groups)[0]).toEqual({
      person: "me",
      calendars: ["mine-3", "mine-1", "mine-2"],
    });
  });

  it("puts a calendar I just got access to at the end of its owner's list (RF-47)", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME, ANA],
      calendars: [
        calendar("ana-old", "ana", "2026-01-01T00:00:00Z"),
        calendar("ana-new", "ana", "2026-06-01T00:00:00Z"),
      ],
      calendarPreferences: [
        { calendarId: "ana-old", visible: true, position: 0 },
      ],
      personPreferences: [],
    });

    expect(names(groups)[1]).toEqual({
      person: "ana",
      calendars: ["ana-old", "ana-new"],
    });
  });
});

describe("visibility (RF-43, RF-47)", () => {
  it("shows calendars without a saved preference and hides those saved as hidden", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME],
      calendars: [calendar("a", "me"), calendar("b", "me")],
      calendarPreferences: [
        { calendarId: "b", visible: false, position: null },
      ],
      personPreferences: [],
    });

    expect(groups[0]?.calendars.map((c) => [c.id, c.visible])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });
});

describe("calendars without owner (spec 006 RF-22)", () => {
  const orphan = (id: string, createdAt = "2026-01-01T00:00:00Z") => ({
    id,
    ownerId: null,
    name: id,
    createdAt,
  });

  it("puts them in a last group called Sin propietario, after every person", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME, ANA],
      calendars: [
        orphan("orphan-2", "2026-02-01T00:00:00Z"),
        calendar("ana-1", "ana"),
        orphan("orphan-1"),
        calendar("mine-1", "me"),
      ],
      calendarPreferences: [],
      personPreferences: [
        { personId: "ana", position: 0 },
        { personId: "me", position: 1 },
      ],
    });

    expect(names(groups)).toEqual([
      { person: "ana", calendars: ["ana-1"] },
      { person: "me", calendars: ["mine-1"] },
      { person: ORPHAN_GROUP_ID, calendars: ["orphan-1", "orphan-2"] },
    ]);
    expect(groups.at(-1)?.person).toEqual({
      id: ORPHAN_GROUP_ID,
      displayName: "Sin propietario",
      isMe: false,
    });
  });

  it("keeps their saved visibility", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME],
      calendars: [orphan("orphan-1")],
      calendarPreferences: [
        { calendarId: "orphan-1", visible: false, position: null },
      ],
      personPreferences: [],
    });

    expect(groups.at(-1)?.calendars[0]?.visible).toBe(false);
  });

  it("has no such group when every calendar has an owner", () => {
    const groups = groupByPerson({
      currentUserId: "me",
      people: [ME],
      calendars: [calendar("mine-1", "me")],
      calendarPreferences: [],
      personPreferences: [],
    });

    expect(groups.map((g) => g.person.id)).not.toContain(ORPHAN_GROUP_ID);
  });
});
