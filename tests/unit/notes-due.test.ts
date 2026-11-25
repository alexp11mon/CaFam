import { describe, expect, it } from "vitest";
import { dueLabel, isOverdue, nextDue, quickDates } from "@/lib/notes/due";

const TODAY = "2026-11-25"; // a Wednesday

describe("dueLabel (spec 048 RF-2)", () => {
  it.each([
    ["2026-11-25", null, "hoy"],
    ["2026-11-26", null, "mañana"],
    ["2026-11-24", null, "ayer"],
    ["2026-11-27", null, "vie 27"],
    ["2026-12-04", null, "vie, 4 dic"],
    ["2026-11-26", "18:30", "mañana · 18:30"],
  ])("%s %s → %s", (date, time, label) => {
    expect(dueLabel(date, time, TODAY)).toBe(label);
  });
});

describe("isOverdue", () => {
  it("is past the day, or past the hour today", () => {
    expect(isOverdue("2026-11-24", null, TODAY, "08:00")).toBe(true);
    expect(isOverdue("2026-11-25", null, TODAY, "23:00")).toBe(false);
    expect(isOverdue("2026-11-25", "10:00", TODAY, "10:01")).toBe(true);
    expect(isOverdue("2026-11-25", "10:00", TODAY, "09:59")).toBe(false);
    expect(isOverdue("2026-11-26", null, TODAY, "23:59")).toBe(false);
  });
});

describe("nextDue", () => {
  const item = (
    id: string,
    done: boolean,
    dueDate?: string,
    dueTime?: string,
  ) => ({
    id,
    text: id,
    done,
    doneAt: null,
    position: 0,
    dueDate: dueDate ?? null,
    dueTime: dueTime ?? null,
  });

  it("is the closest pending date, done ones left out", () => {
    expect(
      nextDue([
        item("a", false, "2026-12-03"),
        item("b", true, "2026-11-20"),
        item("c", false, "2026-12-01", "18:00"),
        item("d", false, "2026-12-01", "09:00"),
        item("e", false),
      ]),
    ).toEqual({ date: "2026-12-01", time: "09:00" });
    expect(nextDue([item("x", false)])).toBeNull();
  });
});

describe("quickDates (spec 048 RF-1)", () => {
  it("offers today, tomorrow and next Monday", () => {
    expect(quickDates(TODAY)).toEqual({
      today: "2026-11-25",
      tomorrow: "2026-11-26",
      nextWeek: "2026-11-30",
    });
    // On a Sunday, next week starts the next day.
    expect(quickDates("2026-11-29").nextWeek).toBe("2026-11-30");
  });
});
