import { describe, expect, it } from "vitest";
import { eventsInRange } from "@/lib/calendar/event-window";
import {
  isUsable,
  mergeWindow,
  SNAPSHOT_FORMAT,
  type OfflineEvent,
  type WindowEvent,
} from "@/lib/offline/snapshot";

const stored = (
  id: string,
  startsAt: string,
  extra: Partial<OfflineEvent> = {},
): OfflineEvent => ({
  id,
  calendarId: "cal",
  title: `Evento ${id}`,
  startsAt,
  endsAt: startsAt,
  allDay: false,
  color: null,
  categoryId: null,
  location: null,
  imageCount: 0,
  commentCount: 0,
  seriesId: null,
  description: `Descripción ${id}`,
  createdBy: "user",
  createdByName: "Ana",
  seriesSummary: null,
  seriesChanged: false,
  ...extra,
});

const seen = (
  id: string,
  startsAt: string,
  title = `Nuevo ${id}`,
): WindowEvent => ({
  id,
  title,
  startsAt,
  endsAt: startsAt,
  allDay: false,
  calendarId: "cal",
  ownColor: "#FFADAD",
});

const window = (events: WindowEvent[]) => ({
  range: { from: "2026-11-01", to: "2026-11-30" },
  events,
});

describe("mergeWindow (spec 034 RF-5, plan D9)", () => {
  it("updates a known event and keeps the detail the window lacks", () => {
    const [merged] = mergeWindow(
      [stored("a", "2026-11-10T09:00:00Z")],
      window([seen("a", "2026-11-11T09:00:00Z", "Cambiado")]),
    );
    expect(merged).toMatchObject({
      title: "Cambiado",
      startsAt: "2026-11-11T09:00:00Z",
      color: "#FFADAD",
      description: "Descripción a",
      createdByName: "Ana",
    });
    expect(merged?.partial).toBeUndefined();
  });

  it("drops what disappeared from the window's days and keeps the rest", () => {
    const merged = mergeWindow(
      [
        stored("gone", "2026-11-10T09:00:00Z"),
        stored("far", "2027-01-10T09:00:00Z"),
      ],
      window([]),
    );
    expect(merged.map((event) => event.id)).toEqual(["far"]);
  });

  it("marks a new event partial until the next full reading", () => {
    const [merged] = mergeWindow(
      [],
      window([seen("new", "2026-11-12T09:00:00Z")]),
    );
    expect(merged).toMatchObject({
      id: "new",
      partial: true,
      description: null,
    });
  });

  it("keeps an event partial while no full reading came", () => {
    const [merged] = mergeWindow(
      [stored("p", "2026-11-12T09:00:00Z", { partial: true })],
      window([seen("p", "2026-11-12T09:00:00Z")]),
    );
    expect(merged?.partial).toBe(true);
  });

  it("sorts by start", () => {
    const merged = mergeWindow(
      [stored("late", "2027-01-10T09:00:00Z")],
      window([seen("early", "2026-11-02T09:00:00Z")]),
    );
    expect(merged.map((event) => event.id)).toEqual(["early", "late"]);
  });

  it("reads back by range like the window does", () => {
    const events = [
      stored("in", "2026-11-10T09:00:00Z"),
      stored("out", "2026-12-10T09:00:00Z"),
    ];
    expect(
      eventsInRange(
        events,
        new Date("2026-11-01T00:00:00Z"),
        new Date("2026-12-01T00:00:00Z"),
      ).map((event) => event.id),
    ).toEqual(["in"]);
  });
});

describe("isUsable (plan R1)", () => {
  it("accepts only the current format", () => {
    expect(isUsable({ format: SNAPSHOT_FORMAT })).toBe(true);
    expect(isUsable({ format: SNAPSHOT_FORMAT - 1 })).toBe(false);
    expect(isUsable(null)).toBe(false);
  });
});
