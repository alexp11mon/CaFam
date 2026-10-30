import { describe, expect, it } from "vitest";
import {
  anchorDay,
  buildAgendaFeed,
  weekLabel,
  type AgendaFeedItem,
} from "@/lib/calendar/agenda-feed";
import { addDays } from "@/lib/calendar/time-zone";

const MADRID = "Europe/Madrid";

interface Item {
  id: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location?: string | null;
}

function range(first: string, count: number) {
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}

// 2026-11-02 is winter time in Madrid (UTC+1).
const exam: Item = {
  id: "exam",
  startsAt: "2026-11-02T10:15:00Z",
  endsAt: "2026-11-02T13:15:00Z",
  allDay: false,
  location: "4D - AULA 1.3",
};
const english: Item = {
  id: "english",
  startsAt: "2026-11-03T08:15:00Z",
  endsAt: "2026-11-03T10:15:00Z",
  allDay: false,
};
const holiday: Item = {
  id: "holiday",
  startsAt: "2026-11-04T00:00:00Z",
  endsAt: "2026-11-05T00:00:00Z",
  allDay: true,
};

const kinds = (feed: AgendaFeedItem<Item>[]) =>
  feed.map((item) => `${item.kind}:${item.key}`);

describe("buildAgendaFeed (spec 016 RF-47..RF-57)", () => {
  const feed = buildAgendaFeed({
    days: range("2026-10-26", 21),
    events: [exam, english, holiday],
    timeZone: MADRID,
    today: "2026-11-03",
  });

  it("starts each month with a band and each week with a separator", () => {
    expect(kinds(feed)).toEqual([
      "month:2026-10",
      "week:2026-10-26",
      "month:2026-11",
      "week:2026-11-01",
      "week:2026-11-02",
      "day:2026-11-02",
      "day:2026-11-03",
      "day:2026-11-04",
      "week:2026-11-09",
    ]);
  });

  it("marks the weeks without events and only lists days with events", () => {
    const weeks = feed.filter((item) => item.kind === "week");

    expect(weeks.map((week) => week.empty)).toEqual([true, true, false, true]);
  });

  it("labels the week with its days", () => {
    expect(feed.find((item) => item.key === "2026-11-02")).toMatchObject({
      kind: "week",
      label: "2–8 de noviembre",
    });
  });

  it("names the month, with the year when it is not the current one", () => {
    expect(feed[2]).toMatchObject({ kind: "month", label: "noviembre" });
    const next = buildAgendaFeed({
      days: ["2027-01-01"],
      events: [],
      timeZone: MADRID,
      today: "2026-11-03",
    });
    expect(next[0]).toMatchObject({ label: "enero de 2027" });
  });

  it("writes the hours and the place of a timed event", () => {
    const day = feed.find(
      (item) => item.kind === "day" && item.key === "2026-11-02",
    );

    expect(day).toMatchObject({
      weekday: "lun",
      number: "2",
      isToday: false,
      entries: [{ line: "A las 11:15–14:15 en 4D - AULA 1.3" }],
    });
  });

  it("writes only the hours without a place and nothing for all-day events", () => {
    const line = (key: string) =>
      feed.find((item) => item.kind === "day" && item.key === key);

    expect(line("2026-11-03")).toMatchObject({
      isToday: true,
      entries: [{ line: "9:15–11:15" }],
    });
    expect(line("2026-11-04")).toMatchObject({ entries: [{ line: null }] });
  });

  it("shows an event crossing midnight on both days", () => {
    const night: Item = {
      id: "night",
      startsAt: "2026-11-02T22:00:00Z",
      endsAt: "2026-11-03T01:00:00Z",
      allDay: false,
    };
    const days = buildAgendaFeed({
      days: range("2026-11-02", 2),
      events: [night],
      timeZone: MADRID,
      today: "2026-11-02",
    }).filter((item) => item.kind === "day");

    expect(days.map((day) => day.key)).toEqual(["2026-11-02", "2026-11-03"]);
  });
});

describe("anchorDay (spec 016 RF-58)", () => {
  const feed = buildAgendaFeed({
    days: range("2026-11-02", 7),
    events: [exam, holiday],
    timeZone: MADRID,
    today: "2026-11-03",
  });

  it("is the first day with events from today on", () => {
    expect(anchorDay(feed, "2026-11-03")).toBe("2026-11-04");
    expect(anchorDay(feed, "2026-11-02")).toBe("2026-11-02");
  });

  it("is null when nothing comes after today", () => {
    expect(anchorDay(feed, "2026-11-20")).toBeNull();
  });
});

describe("weekLabel (spec 016 RF-51)", () => {
  it("joins days of the same month and of two months", () => {
    expect(weekLabel("2026-11-02", "2026-11-08")).toBe("2–8 de noviembre");
    expect(weekLabel("2026-10-26", "2026-11-01")).toBe(
      "26 de octubre – 1 de noviembre",
    );
  });
});
