import { describe, expect, it } from "vitest";
import { clickRange, dragRange, minuteAt } from "@/lib/calendar/slots";

// Spec 008, T13: where a click or a drag on the hour grid lands (RF-20, RF-30, RF-42, RF-43).
const DAY_PX = 24 * 48; // 48 px per hour, as the time grid

describe("minuteAt", () => {
  it("rounds down to the half hour on a click", () => {
    expect(minuteAt(10.2 * 48, DAY_PX, 30)).toBe(600); // 10:12 → 10:00
    expect(minuteAt(10.6 * 48, DAY_PX, 30)).toBe(630); // 10:36 → 10:30
  });

  it("rounds to the quarter while dragging", () => {
    expect(minuteAt(16.3 * 48, DAY_PX, 15)).toBe(975); // 16:18 → 16:15
    expect(minuteAt(16.35 * 48, DAY_PX, 15)).toBe(975); // 16:21 → 16:15
    expect(minuteAt(16.4 * 48, DAY_PX, 15)).toBe(990); // 16:24 → 16:30
  });

  it("stays inside the day", () => {
    expect(minuteAt(-20, DAY_PX, 15)).toBe(0);
    expect(minuteAt(DAY_PX + 50, DAY_PX, 15)).toBe(1440);
    expect(minuteAt(DAY_PX - 1, DAY_PX, 30)).toBe(1410);
  });
});

describe("clickRange (RF-20, RF-30)", () => {
  it("starts on the half hour and lasts one hour", () => {
    expect(clickRange(612)).toEqual({ start: 600, end: 660 });
  });

  it("ends at 23:59 at the end of the day", () => {
    expect(clickRange(23 * 60 + 40)).toEqual({ start: 1410, end: 1439 });
  });
});

describe("dragRange (RF-42, RF-43)", () => {
  it("goes from the start of the drag to its end", () => {
    expect(dragRange(960, 1050)).toEqual({ start: 960, end: 1050 });
  });

  it("orders an upward drag", () => {
    expect(dragRange(1050, 960)).toEqual({ start: 960, end: 1050 });
  });

  it("lasts at least 15 minutes", () => {
    expect(dragRange(960, 960)).toEqual({ start: 960, end: 975 });
  });

  it("stays inside the day, ending at 23:59 at most", () => {
    expect(dragRange(1380, 1440)).toEqual({ start: 1380, end: 1439 });
    expect(dragRange(-30, 60)).toEqual({ start: 0, end: 60 });
    expect(dragRange(1440, 1440)).toEqual({ start: 1424, end: 1439 });
  });
});
