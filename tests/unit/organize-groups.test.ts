import { describe, expect, it } from "vitest";
import { ORPHAN_GROUP_ID } from "@/lib/calendar/grouping";
import { organizeGroups } from "@/lib/calendar/organize-groups";

// Spec 007, T12: the user's groups first, then the rest by person
// (RF-36, RF-37, RF-40, RF-42, RF-46).
const ME = "me";
const calendar = (id: string, ownerId: string | null = ME) => ({
  id,
  name: id,
  ownerId,
  createdAt: `2026-01-0${id.length}T00:00:00Z`,
});

const base = {
  currentUserId: ME,
  people: [
    { id: ME, displayName: "Yo" },
    { id: "bea", displayName: "Bea" },
  ],
  personPreferences: [],
};

describe("organizeGroups", () => {
  it("puts grouped calendars in their groups, in order, and the rest by person, without repeating", () => {
    const result = organizeGroups({
      ...base,
      calendars: [
        calendar("a"),
        calendar("bb"),
        calendar("ccc", "bea"),
        calendar("dddd"),
      ],
      groups: [
        { id: "g2", name: "Ocio", position: 1 },
        { id: "g1", name: "Trabajo", position: 0 },
      ],
      calendarPreferences: [
        { calendarId: "a", visible: true, position: 1, groupId: "g1" },
        { calendarId: "ccc", visible: true, position: 0, groupId: "g1" },
        { calendarId: "bb", visible: true, position: null, groupId: "g2" },
      ],
    });

    expect(result.groups.map((g) => g.group.name)).toEqual(["Trabajo", "Ocio"]);
    expect(result.groups[0].calendars.map((c) => c.id)).toEqual(["ccc", "a"]);
    expect(result.groups[1].calendars.map((c) => c.id)).toEqual(["bb"]);
    expect(result.people.flatMap((p) => p.calendars.map((c) => c.id))).toEqual([
      "dddd",
    ]);
  });

  it("keeps empty groups and orders groups without position by name", () => {
    const result = organizeGroups({
      ...base,
      calendars: [calendar("a")],
      groups: [
        { id: "z", name: "Zeta", position: null },
        { id: "y", name: "alfa", position: null },
      ],
      calendarPreferences: [],
    });

    expect(result.groups.map((g) => g.group.name)).toEqual(["alfa", "Zeta"]);
    expect(result.groups[0].calendars).toEqual([]);
  });

  it("marks each group shown, hidden or partial (RF-40)", () => {
    const result = organizeGroups({
      ...base,
      calendars: [calendar("a"), calendar("bb"), calendar("ccc")],
      groups: [
        { id: "on", name: "A", position: 0 },
        { id: "off", name: "B", position: 1 },
        { id: "mix", name: "C", position: 2 },
      ],
      calendarPreferences: [
        { calendarId: "a", visible: true, position: null, groupId: "on" },
        { calendarId: "bb", visible: false, position: null, groupId: "off" },
        { calendarId: "ccc", visible: false, position: 0, groupId: "mix" },
        { calendarId: "dddd", visible: true, position: 1, groupId: "mix" },
      ],
    });

    expect(result.groups.map((g) => g.visibility)).toEqual([
      "shown",
      "hidden",
      "hidden",
    ]);

    const partial = organizeGroups({
      ...base,
      calendars: [calendar("a"), calendar("bb")],
      groups: [{ id: "mix", name: "C", position: 0 }],
      calendarPreferences: [
        { calendarId: "a", visible: false, position: null, groupId: "mix" },
        { calendarId: "bb", visible: true, position: null, groupId: "mix" },
      ],
    });
    expect(partial.groups[0].visibility).toBe("partial");
  });

  it("marks a calendar without owner inside a group and leaves the orphan group out (RF-46)", () => {
    const result = organizeGroups({
      ...base,
      calendars: [calendar("a"), calendar("bb", null)],
      groups: [{ id: "g", name: "Familia", position: 0 }],
      calendarPreferences: [
        { calendarId: "bb", visible: true, position: null, groupId: "g" },
      ],
    });

    expect(result.groups[0].calendars[0]).toMatchObject({
      id: "bb",
      orphan: true,
    });
    expect(result.people.map((p) => p.person.id)).not.toContain(
      ORPHAN_GROUP_ID,
    );
  });

  it("ignores an assignment to a group that is not in the list", () => {
    const result = organizeGroups({
      ...base,
      calendars: [calendar("a")],
      groups: [],
      calendarPreferences: [
        { calendarId: "a", visible: true, position: null, groupId: "gone" },
      ],
    });

    expect(result.people[0].calendars.map((c) => c.id)).toEqual(["a"]);
  });
});
