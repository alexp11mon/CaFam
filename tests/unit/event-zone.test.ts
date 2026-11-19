import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editZones,
  offsetLabel,
  originalLabel,
  pushRecentZone,
  zoneCity,
  zoneOptions,
} from "@/lib/calendar/event-zone";

// Spec 045, T2 (RF-1, RF-5).
const ROW = {
  startsAt: "2026-12-01T23:00:00Z",
  endsAt: "2026-12-02T01:00:00Z",
  allDay: false,
  startTz: null as string | null,
  endTz: null as string | null,
  recurrenceTz: null as string | null,
};

describe("editZones", () => {
  it("is the profile's zone without an own zone (RF-6)", () => {
    expect(editZones(ROW, "Europe/Madrid")).toEqual({
      start: "Europe/Madrid",
      end: "Europe/Madrid",
    });
  });

  it("is the event's own zone, or the series' one", () => {
    expect(
      editZones({ ...ROW, startTz: "America/New_York" }, "Europe/Madrid"),
    ).toEqual({ start: "America/New_York", end: "America/New_York" });
    expect(
      editZones(
        { ...ROW, startTz: "Europe/Madrid", endTz: "Asia/Kolkata" },
        "UTC",
      ),
    ).toEqual({ start: "Europe/Madrid", end: "Asia/Kolkata" });
    expect(
      editZones({ ...ROW, recurrenceTz: "Atlantic/Canary" }, "Europe/Madrid"),
    ).toEqual({ start: "Atlantic/Canary", end: "Atlantic/Canary" });
  });
});

describe("originalLabel (RF-5)", () => {
  it("is null when the zone is the reader's or there is none", () => {
    expect(originalLabel(ROW, "Europe/Madrid")).toBeNull();
    expect(
      originalLabel({ ...ROW, startTz: "Europe/Madrid" }, "Europe/Madrid"),
    ).toBeNull();
    expect(
      originalLabel(
        { ...ROW, allDay: true, startTz: "America/New_York" },
        "Europe/Madrid",
      ),
    ).toBeNull();
  });

  it("shows the hours in the event's zone", () => {
    expect(
      originalLabel({ ...ROW, startTz: "America/New_York" }, "Europe/Madrid"),
    ).toBe("18:00–20:00 en New York (America/New_York)");
  });

  it("shows both ends when they are in different zones", () => {
    expect(
      originalLabel(
        {
          ...ROW,
          startsAt: "2026-12-01T09:00:00Z",
          endsAt: "2026-12-01T17:00:00Z",
          startTz: "Europe/Madrid",
          endTz: "America/New_York",
        },
        "Europe/Madrid",
      ),
    ).toBe(
      "10:00 en Madrid (Europe/Madrid) – 12:00 en New York (America/New_York)",
    );
  });

  it("handles half-hour zones", () => {
    expect(
      originalLabel({ ...ROW, startTz: "Asia/Kolkata" }, "Europe/Madrid"),
    ).toBe("04:30–06:30 en Kolkata (Asia/Kolkata)");
  });
});

describe("offsetLabel", () => {
  const winter = Date.parse("2026-01-15T12:00:00Z");
  const summer = Date.parse("2026-07-15T12:00:00Z");

  it("follows the change of hour", () => {
    expect(offsetLabel("America/New_York", winter)).toBe("GMT−5");
    expect(offsetLabel("America/New_York", summer)).toBe("GMT−4");
    expect(offsetLabel("Europe/Madrid", summer)).toBe("GMT+2");
  });

  it("writes half hours and zero", () => {
    expect(offsetLabel("Asia/Kolkata", winter)).toBe("GMT+5:30");
    expect(offsetLabel("UTC", winter)).toBe("GMT");
  });
});

describe("zoneOptions (RF-1)", () => {
  afterEach(() => vi.restoreAllMocks());
  const now = Date.parse("2026-01-15T12:00:00Z");

  it("labels every zone with its city and offset, recent ones first", () => {
    const options = zoneOptions(now, ["Asia/Kolkata"]);
    expect(options[0]).toEqual({
      id: "Asia/Kolkata",
      label: "Kolkata (GMT+5:30)",
      recent: true,
    });
    const york = options.find((option) => option.id === "America/New_York");
    expect(york).toEqual({
      id: "America/New_York",
      label: "New York (GMT−5)",
      recent: false,
    });
    expect(
      options.filter((option) => option.id === "Asia/Kolkata"),
    ).toHaveLength(1);
  });

  it("falls back to a short list without Intl.supportedValuesOf", () => {
    vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new TypeError("not supported");
    });
    const ids = zoneOptions(now, []).map((option) => option.id);
    expect(ids).toContain("Europe/Madrid");
    expect(ids).toContain("America/New_York");
    expect(ids).toContain("UTC");
  });
});

describe("pushRecentZone and zoneCity", () => {
  it("keeps the last 8 without repeats", () => {
    const list = ["A/1", "A/2", "A/3", "A/4", "A/5", "A/6", "A/7", "A/8"];
    expect(pushRecentZone(list, "A/3")).toEqual([
      "A/3",
      "A/1",
      "A/2",
      "A/4",
      "A/5",
      "A/6",
      "A/7",
      "A/8",
    ]);
    expect(pushRecentZone(list, "B/9")).toHaveLength(8);
    expect(pushRecentZone(list, "B/9")[0]).toBe("B/9");
  });

  it("names a zone by its city", () => {
    expect(zoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(zoneCity("UTC")).toBe("UTC");
  });
});
