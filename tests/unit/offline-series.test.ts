import { describe, expect, it } from "vitest";
import type { EventData } from "@/lib/calendar/schemas";
import { zonedDateKey } from "@/lib/calendar/time-zone";
import type { OfflineChange, OutboxEntry } from "@/lib/offline/outbox";
import type { PendingEvent } from "@/lib/offline/overlay";
import { lossInCopy } from "@/lib/offline/series-loss";
import {
  pendingSeries,
  seriesLossQuery,
  type SeriesCopy,
} from "@/lib/offline/series-overlay";
import type { OfflineSeries } from "@/lib/offline/snapshot";
import { occurrenceId } from "@/lib/recurrence/occurrence-id";
import { expandRows } from "@/lib/recurrence/read-series";

// Spec 035 T2: series changed offline, as they will be (RF-11 to RF-13).
const ZONE = "Europe/Madrid";
const S = "11111111-1111-4111-8111-111111111111";
const CAL = "22222222-2222-4222-8222-222222222222";
const RANGE = { from: "2026-10-01", to: "2026-11-30" };

// Every Monday at 18:00 in Madrid from 5 October: summer time until the 25th.
const series: OfflineSeries = {
  id: S,
  calendarId: CAL,
  title: "Inglés",
  description: "Aula 3",
  location: null,
  color: null,
  categoryId: null,
  startsAt: "2026-10-05T16:00:00.000Z",
  endsAt: "2026-10-05T17:00:00.000Z",
  allDay: false,
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO",
  recurrenceTz: ZONE,
  recurrenceUntil: null,
  exdates: [],
  totals: { exceptions: 0, images: 0, comments: 0, latest: null },
};

function occurrences(row: OfflineSeries): PendingEvent[] {
  return expandRows(
    [
      {
        id: row.id,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
        all_day: row.allDay,
        recurrence: row.recurrence,
        recurrence_tz: row.recurrenceTz,
        exdates: row.exdates,
      },
    ],
    [],
    new Date("2026-09-30T00:00:00Z"),
    new Date("2026-12-02T00:00:00Z"),
  ).map(({ occurrence }) => ({
    id: occurrenceId(row.id, occurrence.originalStart),
    calendarId: row.calendarId,
    title: row.title,
    startsAt: occurrence.startsAt,
    endsAt: occurrence.endsAt,
    allDay: false,
    color: null,
    categoryId: null,
    location: null,
    description: row.description,
    imageCount: 0,
    commentCount: 0,
    seriesId: row.id,
    createdBy: null,
    createdByName: null,
    seriesSummary: "Cada semana el lunes",
    seriesChanged: false,
  }));
}

const copy: SeriesCopy = {
  events: occurrences(series),
  series: [series],
  exceptions: [],
  range: RANGE,
  timeZone: ZONE,
};

const data = (
  startsAt: string,
  endsAt: string,
  title = "Inglés",
): EventData => ({
  title,
  calendarId: CAL,
  allDay: false,
  startsAt,
  endsAt,
  description: "Aula 3",
  location: null,
  color: null,
  categoryId: null,
});

const queue = (...changes: OfflineChange[]): OutboxEntry[] =>
  changes.map((change, i) => ({
    changeId: `c${i}`,
    createdAt: "2026-11-01T10:00:00.000Z",
    change,
  }));

const base = {
  fields: data(series.startsAt, series.endsAt),
  recurrence: series.recurrence,
  exdates: [],
  totals: series.totals,
};
const NOV2 = occurrenceId(S, "2026-11-02T17:00:00.000Z");

const localTimes = (events: PendingEvent[]) =>
  events
    .filter((event) => event.seriesId)
    .map((event) =>
      new Intl.DateTimeFormat("es-ES", {
        timeZone: ZONE,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(event.startsAt)),
    );

describe("pendingSeries (RF-11, RF-12)", () => {
  it("leaves the copy as it is without series changes", () => {
    expect(pendingSeries(copy, [])).toHaveLength(copy.events.length);
  });

  it("moves every occurrence on the wall clock across the change of time", () => {
    const events = pendingSeries(
      copy,
      queue({
        type: "series.update",
        id: NOV2,
        scope: "all",
        base,
        data: data("2026-11-02T18:00:00.000Z", "2026-11-02T19:00:00.000Z"),
        repeat: "weekly",
      }),
    );
    const times = localTimes(events);
    expect(times).toContain("5/10, 19:00");
    expect(times).toContain("2/11, 19:00");
    expect(times.every((time) => time.endsWith("19:00"))).toBe(true);
    expect(events.every((event) => !event.seriesId || event.pending)).toBe(
      true,
    );
  });

  it("only that occurrence with 'Solo este evento'", () => {
    const events = pendingSeries(
      copy,
      queue({
        type: "series.update",
        id: NOV2,
        scope: "this",
        base,
        data: data(
          "2026-11-02T17:00:00.000Z",
          "2026-11-02T18:00:00.000Z",
          "Examen",
        ),
        repeat: "weekly",
      }),
    );
    expect(events.filter((e) => e.title === "Examen").map((e) => e.id)).toEqual(
      [NOV2],
    );
  });

  it("splits the series with 'Este y los siguientes'", () => {
    const events = pendingSeries(
      copy,
      queue({
        type: "series.update",
        id: NOV2,
        scope: "following",
        base,
        data: data(
          "2026-11-02T17:00:00.000Z",
          "2026-11-02T18:00:00.000Z",
          "Inglés B2",
        ),
        repeat: "weekly",
      }),
    );
    const before = events.filter((e) => e.startsAt < "2026-11-02");
    const after = events.filter((e) => e.startsAt >= "2026-11-02");
    expect(before.every((e) => e.title === "Inglés")).toBe(true);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((e) => e.title === "Inglés B2")).toBe(true);
  });

  it("deletes from a date on", () => {
    const events = pendingSeries(
      copy,
      queue({ type: "series.delete", id: NOV2, scope: "following", base }),
    );
    expect(events.length).toBe(4);
    expect(events.every((e) => e.startsAt < "2026-11-02")).toBe(true);
  });

  it("deletes one occurrence and the whole series", () => {
    expect(
      pendingSeries(
        copy,
        queue({ type: "series.delete", id: NOV2, scope: "this", base }),
      ).map((e) => e.id),
    ).not.toContain(NOV2);
    expect(
      pendingSeries(
        copy,
        queue({ type: "series.delete", id: NOV2, scope: "all", base }),
      ),
    ).toEqual([]);
  });

  it("expands a series created offline (RF-11)", () => {
    const id = "33333333-3333-4333-8333-333333333333";
    const events = pendingSeries(
      { ...copy, events: [], series: [] },
      queue({
        type: "event.create",
        id,
        data: data("2026-11-16T08:00:00.000Z", "2026-11-16T09:00:00.000Z"),
        repeat: "daily",
      }),
    );
    // 16 to 30 November, and the day of slack of the copy (zones).
    expect(events.filter((e) => e.startsAt < "2026-12-01").length).toBe(15);
    expect(events.every((e) => e.seriesId === id && e.pending)).toBe(true);
    expect(events[0]!.seriesSummary).toBe("Cada día");
  });

  it("turns a single event into a series (RF-11)", () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const single = {
      ...copy.events[0]!,
      id,
      seriesId: null,
      startsAt: "2026-11-23T09:00:00.000Z",
      endsAt: "2026-11-23T10:00:00.000Z",
    };
    const events = pendingSeries(
      { ...copy, events: [single], series: [] },
      queue({
        type: "event.update",
        id,
        base: data(single.startsAt, single.endsAt),
        data: data(single.startsAt, single.endsAt),
        repeat: "weekly",
      }),
    );
    expect(events.map((e) => zonedDateKey(e.startsAt, ZONE))).toEqual([
      "2026-11-23",
      "2026-11-30",
    ]);
    expect(events.every((e) => e.id !== id)).toBe(true);
  });
});

describe("what a change would lose (RF-13)", () => {
  const EXC = "55555555-5555-4555-8555-555555555555";
  const OLD = "66666666-6666-4666-8666-666666666666";
  const lossCopy = {
    exceptions: [
      { id: OLD, seriesId: S, originalStart: "2026-10-12T16:00:00.000Z" },
      { id: EXC, seriesId: S, originalStart: "2026-11-09T17:00:00.000Z" },
    ],
    images: [
      {
        id: "i1",
        eventId: EXC,
        uploadedBy: null,
        createdAt: "",
        width: 1,
        height: 1,
      },
    ],
    comments: [
      {
        id: "k1",
        eventId: EXC,
        authorId: null,
        authorName: "Ana",
        body: "Hola",
        createdAt: "",
        editedAt: null,
      },
      {
        id: "k2",
        eventId: OLD,
        authorId: null,
        authorName: "Ana",
        body: "Hola",
        createdAt: "",
        editedAt: null,
      },
    ],
  };

  it("counts the exceptions from the date with their images and comments", () => {
    expect(
      lossInCopy(S, { from: "2026-11-02T17:00:00.000Z" }, lossCopy),
    ).toEqual({ exceptions: 1, images: 1, comments: 1 });
  });

  it("counts every exception of the series, and none for nothing lost", () => {
    expect(lossInCopy(S, {}, lossCopy)).toEqual({
      exceptions: 2,
      images: 1,
      comments: 2,
    });
    expect(lossInCopy(S, null, lossCopy)).toBeNull();
    expect(lossInCopy(S, { only: "2026-11-16T17:00:00.000Z" }, lossCopy)).toBe(
      null,
    );
  });

  it("asks the plan which occurrences a change touches", () => {
    const withExc = {
      ...copy,
      exceptions: lossCopy.exceptions,
    };
    expect(
      seriesLossQuery(withExc, {
        type: "series.delete",
        id: NOV2,
        scope: "following",
        base,
      }),
    ).toEqual({ from: "2026-11-02T17:00:00.000Z" });
    expect(
      seriesLossQuery(withExc, {
        type: "series.update",
        id: NOV2,
        scope: "all",
        base,
        data: data("2026-11-02T17:00:00.000Z", "2026-11-02T18:00:00.000Z"),
        repeat: "daily",
      }),
    ).toEqual({});
  });
});
