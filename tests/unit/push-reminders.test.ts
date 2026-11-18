// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  dueReminders,
  REMINDER_OPTIONS,
  type ReminderRow,
} from "@/lib/push/reminders";

// Spec 040, T2: when each reminder is due (RF-5, RF-8 to RF-10, RF-12).
function row(extra: Partial<ReminderRow> = {}): ReminderRow {
  return {
    userId: "u1",
    eventId: "e1",
    title: "Cena",
    location: null,
    startsAt: "2026-11-20T19:00:00Z",
    endsAt: "2026-11-20T20:00:00Z",
    allDay: false,
    recurrence: null,
    recurrenceTz: null,
    exdates: [],
    seriesId: null,
    minutes: [10],
    timeZone: "Europe/Madrid",
    ...extra,
  };
}

const at = (iso: string) => new Date(iso);

describe("dueReminders", () => {
  it("is due from its time to 15 minutes later, and 1 minute early", () => {
    const rows = [row()];
    expect(dueReminders(rows, [], at("2026-11-20T18:48:00Z"))).toEqual([]);
    const [due] = dueReminders(rows, [], at("2026-11-20T18:49:30Z"));
    expect(due).toMatchObject({
      userId: "u1",
      eventId: "e1",
      deliveryEventId: "e1",
      occurrenceStart: "2026-11-20T19:00:00.000Z",
      minutes: 10,
      at: "2026-11-20T18:50:00.000Z",
    });
    expect(dueReminders(rows, [], at("2026-11-20T19:05:00Z"))).toHaveLength(1);
    // More than 15 minutes late: never (RF-10).
    expect(dueReminders(rows, [], at("2026-11-20T19:05:01Z"))).toEqual([]);
  });

  it("gives each of the minutes of an event", () => {
    const rows = [row({ minutes: [0, 10] })];
    expect(
      dueReminders(rows, [], at("2026-11-20T19:00:00Z")).map((d) => d.minutes),
    ).toEqual([0, 10]);
  });

  it("warns all-day events at 9:00 in the zone of the profile (RF-9)", () => {
    const rows = [
      row({
        allDay: true,
        startsAt: "2026-11-20T00:00:00Z",
        endsAt: "2026-11-21T00:00:00Z",
        minutes: [1440],
        timeZone: "America/New_York",
      }),
    ];
    // 9:00 in New York the day before = 14:00 UTC.
    expect(dueReminders(rows, [], at("2026-11-19T14:00:00Z"))[0]?.at).toBe(
      "2026-11-19T14:00:00.000Z",
    );
    expect(dueReminders(rows, [], at("2026-11-19T08:00:00Z"))).toEqual([]);
  });

  it("warns each occurrence of a series, by its id, across the change of time (RF-8)", () => {
    const series = row({
      eventId: "s1",
      // Thursdays at 18:00 in Madrid, from October (summer time).
      startsAt: "2026-10-01T16:00:00Z",
      endsAt: "2026-10-01T17:00:00Z",
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
      recurrenceTz: "Europe/Madrid",
    });
    // 5 November is winter time: 18:00 in Madrid is 17:00 UTC.
    const [due] = dueReminders([series], [], at("2026-11-05T16:50:00Z"));
    expect(due).toMatchObject({
      eventId: "s1_20261105T170000Z",
      deliveryEventId: "s1",
      occurrenceStart: "2026-11-05T17:00:00.000Z",
    });
  });

  it("skips deleted occurrences and the moved ones, which warn as themselves", () => {
    const series = row({
      eventId: "s1",
      startsAt: "2026-10-01T16:00:00Z",
      endsAt: "2026-10-01T17:00:00Z",
      recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TH",
      recurrenceTz: "Europe/Madrid",
      exdates: ["2026-11-12T17:00:00Z"],
    });
    const moved = row({
      eventId: "x1",
      seriesId: "s1",
      startsAt: "2026-11-20T09:00:00Z",
      endsAt: "2026-11-20T10:00:00Z",
    });
    const keys = [{ series_id: "s1", original_start: "2026-11-19T17:00:00Z" }];
    expect(
      dueReminders([series, moved], keys, at("2026-11-12T16:50:00Z")),
    ).toEqual([]);
    expect(
      dueReminders([series, moved], keys, at("2026-11-19T16:50:00Z")),
    ).toEqual([]);
    expect(
      dueReminders([series, moved], keys, at("2026-11-20T08:50:00Z"))[0],
    ).toMatchObject({ eventId: "x1", deliveryEventId: "x1" });
  });
});

describe("REMINDER_OPTIONS", () => {
  it("offers the choices of RF-5", () => {
    expect(REMINDER_OPTIONS.timed.map((o) => o.minutes)).toEqual([
      0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080,
    ]);
    expect(REMINDER_OPTIONS.allDay.map((o) => o.label)).toEqual([
      "El mismo día a las 9:00",
      "El día anterior a las 9:00",
      "Una semana antes a las 9:00",
    ]);
  });
});
