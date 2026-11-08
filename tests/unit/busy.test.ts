import { describe, expect, it } from "vitest";
import { busyBlocks, type BusyInput } from "@/lib/availability/busy";

// Spec 020, T3 (RF-10 to RF-13, plan D3).
const ANA = "a";
const LUIS = "l";

const timed = (person: string, start: string, end: string): BusyInput => ({
  personId: person,
  startsAt: `2026-11-10T${start}:00Z`,
  endsAt: `2026-11-10T${end}:00Z`,
  allDay: false,
});

describe("busyBlocks", () => {
  it("merges overlapping and touching intervals of one person (RF-12)", () => {
    const { timed: blocks } = busyBlocks(
      [
        timed(ANA, "09:30", "11:00"),
        timed(ANA, "09:00", "10:00"),
        timed(ANA, "11:00", "12:00"),
        timed(ANA, "14:00", "15:00"),
      ],
      [],
    );
    expect(blocks).toEqual([
      {
        personId: ANA,
        startsAt: "2026-11-10T09:00:00.000Z",
        endsAt: "2026-11-10T12:00:00.000Z",
      },
      {
        personId: ANA,
        startsAt: "2026-11-10T14:00:00.000Z",
        endsAt: "2026-11-10T15:00:00.000Z",
      },
    ]);
  });

  it("never merges two people", () => {
    const { timed: blocks } = busyBlocks(
      [timed(ANA, "09:00", "10:00"), timed(LUIS, "09:30", "11:00")],
      [],
    );
    expect(blocks.map((b) => b.personId)).toEqual([ANA, LUIS]);
  });

  it("drops an interval that exactly matches a visible event, before merging (RF-13)", () => {
    const visible = [
      {
        startsAt: "2026-11-10T09:00:00+00:00",
        endsAt: "2026-11-10T10:00:00+00:00",
        allDay: false,
      },
    ];
    const { timed: blocks } = busyBlocks(
      [timed(ANA, "09:00", "10:00"), timed(ANA, "09:30", "11:00")],
      visible,
    );
    expect(blocks).toEqual([
      {
        personId: ANA,
        startsAt: "2026-11-10T09:30:00.000Z",
        endsAt: "2026-11-10T11:00:00.000Z",
      },
    ]);
  });

  it("keeps an interval that only overlaps a visible event", () => {
    const { timed: blocks } = busyBlocks(
      [timed(ANA, "09:00", "10:30")],
      [
        {
          startsAt: "2026-11-10T09:00:00Z",
          endsAt: "2026-11-10T10:00:00Z",
          allDay: false,
        },
      ],
    );
    expect(blocks).toHaveLength(1);
  });

  it("turns all-day events into merged UTC days (RF-11)", () => {
    const { allDay, timed: blocks } = busyBlocks(
      [
        {
          personId: ANA,
          startsAt: "2026-11-10T00:00:00Z",
          endsAt: "2026-11-11T00:00:00Z",
          allDay: true,
        },
        {
          personId: ANA,
          startsAt: "2026-11-11T00:00:00Z",
          endsAt: "2026-11-13T00:00:00Z",
          allDay: true,
        },
      ],
      [],
    );
    expect(blocks).toEqual([]);
    expect(allDay).toEqual([
      { personId: ANA, startDate: "2026-11-10", endDate: "2026-11-13" },
    ]);
  });

  it("drops an all-day day that matches a visible all-day event", () => {
    const { allDay } = busyBlocks(
      [
        {
          personId: ANA,
          startsAt: "2026-11-10T00:00:00Z",
          endsAt: "2026-11-11T00:00:00Z",
          allDay: true,
        },
      ],
      [
        {
          startsAt: "2026-11-10T00:00:00Z",
          endsAt: "2026-11-11T00:00:00Z",
          allDay: true,
        },
      ],
    );
    expect(allDay).toEqual([]);
  });

  it("each repetition counts on its own (expanded before)", () => {
    const { timed: blocks } = busyBlocks(
      [
        {
          personId: ANA,
          startsAt: "2026-11-09T17:00:00Z",
          endsAt: "2026-11-09T18:00:00Z",
          allDay: false,
        },
        {
          personId: ANA,
          startsAt: "2026-11-16T17:00:00Z",
          endsAt: "2026-11-16T18:00:00Z",
          allDay: false,
        },
      ],
      [],
    );
    expect(blocks).toHaveLength(2);
  });
});
