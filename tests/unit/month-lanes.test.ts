import { describe, expect, it } from "vitest";
import type { LayoutEventInput } from "@/lib/calendar/layout";
import { fitWeek, layoutMonthWeek } from "@/lib/calendar/month-lanes";

const MADRID = "Europe/Madrid";
// Monday 2026-11-02 to Sunday 2026-11-08.
const WEEK = [2, 3, 4, 5, 6, 7, 8].map(
  (day) => `2026-11-${String(day).padStart(2, "0")}`,
);

function timed(id: string, day: string, hour: number): LayoutEventInput {
  const start = `${day}T${String(hour - 1).padStart(2, "0")}:00:00Z`;
  const end = `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
  return { id, startsAt: start, endsAt: end, allDay: false };
}

function allDay(id: string, first: string, afterLast: string) {
  return {
    id,
    startsAt: `${first}T00:00:00Z`,
    endsAt: `${afterLast}T00:00:00Z`,
    allDay: true,
  };
}

describe("layoutMonthWeek (spec 016 RF-34, RF-35)", () => {
  it("draws a multi-day event as one item spanning its days", () => {
    const items = layoutMonthWeek(
      [allDay("trip", "2026-11-04", "2026-11-07")],
      WEEK,
      MADRID,
    );

    expect(items).toEqual([
      expect.objectContaining({ start: 2, span: 3, lane: 0 }),
    ]);
  });

  it("cuts an event crossing two weeks at the edge of each one", () => {
    const trip = allDay("trip", "2026-10-30", "2026-11-04");

    expect(layoutMonthWeek([trip], WEEK, MADRID)).toEqual([
      expect.objectContaining({ start: 0, span: 2 }),
    ]);
    const previous = [26, 27, 28, 29, 30, 31].map((d) => `2026-10-${d}`);
    expect(
      layoutMonthWeek([trip], [...previous, "2026-11-01"], MADRID),
    ).toEqual([expect.objectContaining({ start: 4, span: 3 })]);
  });

  it("puts overlapping events in different lanes, multi-day first", () => {
    const items = layoutMonthWeek(
      [
        timed("a", "2026-11-03", 10),
        allDay("trip", "2026-11-03", "2026-11-05"),
        timed("b", "2026-11-03", 12),
      ],
      WEEK,
      MADRID,
    );

    const lane = (id: string) => items.find((i) => i.event.id === id)?.lane;
    expect(lane("trip")).toBe(0);
    expect(lane("a")).toBe(1);
    expect(lane("b")).toBe(2);
  });

  it("reuses a free lane on other days", () => {
    const items = layoutMonthWeek(
      [timed("a", "2026-11-02", 10), timed("b", "2026-11-03", 10)],
      WEEK,
      MADRID,
    );

    expect(items.map((i) => i.lane)).toEqual([0, 0]);
  });

  it("leaves out events of other weeks", () => {
    expect(
      layoutMonthWeek([timed("a", "2026-11-10", 10)], WEEK, MADRID),
    ).toEqual([]);
  });
});

describe("fitWeek (spec 016 RF-36)", () => {
  const four = layoutMonthWeek(
    [10, 11, 12, 13].map((hour) => timed(`e${hour}`, "2026-11-03", hour)),
    WEEK,
    MADRID,
  );

  it("shows everything when it fits", () => {
    const fit = fitWeek(four, 4);

    expect(fit.visible).toHaveLength(4);
    expect(fit.hidden).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps the last line for +N on a day that does not fit", () => {
    const fit = fitWeek(four, 2);

    expect(fit.visible.map((i) => i.event.id)).toEqual(["e10"]);
    expect(fit.hidden[1]).toBe(3);
  });

  it("does not add +N to a day that fits", () => {
    const items = layoutMonthWeek(
      [
        ...[10, 11, 12].map((h) => timed(`a${h}`, "2026-11-03", h)),
        timed("x", "2026-11-05", 10),
      ],
      WEEK,
      MADRID,
    );
    const fit = fitWeek(items, 2);

    expect(fit.hidden[3]).toBe(0);
    expect(fit.visible.map((i) => i.event.id)).toContain("x");
  });

  it("hides a multi-day item if it does not fit on one of its days", () => {
    const items = layoutMonthWeek(
      [
        timed("a", "2026-11-03", 10),
        timed("b", "2026-11-03", 11),
        allDay("trip", "2026-11-02", "2026-11-04"),
        timed("c", "2026-11-03", 12),
      ],
      WEEK,
      MADRID,
    );
    const fit = fitWeek(items, 2);

    // Tuesday overflows: one lane plus "+N".
    expect(fit.visible.map((i) => i.event.id)).toEqual(["trip"]);
    expect(fit.hidden[0]).toBe(0);
    expect(fit.hidden[1]).toBe(3);
  });

  it("with a single lane shows only +N on a busy day", () => {
    const fit = fitWeek(four, 1);

    expect(fit.visible).toEqual([]);
    expect(fit.hidden[1]).toBe(4);
  });
});
