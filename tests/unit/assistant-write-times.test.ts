import { describe, expect, it } from "vitest";
import { resolveTimes } from "@/lib/assistant/write-times";

// Spec 036, T2: the hours of a new or changed event (RF-4 to RF-11, RF-16,
// RF-26). Madrid is UTC+1 in November and UTC+2 in summer.
const TZ = "Europe/Madrid";
const ctx = { timeZone: TZ, defaultMinutes: 60 };

// PIAE on Thursday 19 November, 12:00-13:30 local.
const PIAE = {
  startsAt: "2026-11-19T11:00:00.000Z",
  endsAt: "2026-11-19T12:30:00.000Z",
  allDay: false,
};

describe("resolveTimes when creating", () => {
  it("starts when the anchor ends and ends at a fixed hour (user's example)", () => {
    expect(resolveTimes({ end: "14:30" }, { ...ctx, after: PIAE })).toEqual({
      status: "ok",
      startsAt: "2026-11-19T12:30:00.000Z",
      endsAt: "2026-11-19T13:30:00.000Z",
      allDay: false,
    });
  });

  it("uses the duration of Ajustes when only the start is known (RF-4)", () => {
    expect(
      resolveTimes(
        { date: "2026-11-20", start: "18:00" },
        { ...ctx, defaultMinutes: 90 },
      ),
    ).toMatchObject({
      startsAt: "2026-11-20T17:00:00.000Z",
      endsAt: "2026-11-20T18:30:00.000Z",
    });
    expect(resolveTimes({}, { ...ctx, after: PIAE })).toMatchObject({
      startsAt: "2026-11-19T12:30:00.000Z",
      endsAt: "2026-11-19T13:30:00.000Z",
    });
  });

  it("uses the duration the user gives", () => {
    expect(
      resolveTimes({ durationMinutes: 30 }, { ...ctx, after: PIAE }),
    ).toMatchObject({ endsAt: "2026-11-19T13:00:00.000Z" });
  });

  it("ends when the anchor starts: «justo antes de» and «hasta» (RF-10, RF-11)", () => {
    expect(resolveTimes({ start: "11:00" }, { ...ctx, before: PIAE })).toEqual({
      status: "ok",
      startsAt: "2026-11-19T10:00:00.000Z",
      endsAt: "2026-11-19T11:00:00.000Z",
      allDay: false,
    });
    expect(
      resolveTimes({ durationMinutes: 15 }, { ...ctx, before: PIAE }),
    ).toMatchObject({ startsAt: "2026-11-19T10:45:00.000Z" });
    expect(resolveTimes({}, { ...ctx, before: PIAE })).toMatchObject({
      startsAt: "2026-11-19T10:00:00.000Z",
    });
  });

  it("refuses an end at or before the start, saying both hours (RF-8)", () => {
    expect(resolveTimes({ end: "13:00" }, { ...ctx, after: PIAE })).toEqual({
      status: "end_before_start",
      date: "2026-11-19",
      start: "13:30",
      end: "13:00",
    });
    expect(
      resolveTimes({ date: "2026-11-20", start: "10:00", end: "10:00" }, ctx),
    ).toMatchObject({ status: "end_before_start" });
  });

  it("does not compute hours from an all-day anchor (RF-16)", () => {
    expect(
      resolveTimes(
        { end: "14:00" },
        {
          ...ctx,
          after: {
            startsAt: "2026-11-19T00:00:00.000Z",
            endsAt: "2026-11-20T00:00:00.000Z",
            allDay: true,
          },
        },
      ),
    ).toEqual({ status: "anchor_all_day" });
  });

  it("asks the hour of a date without hours (RF-5) and a date when none", () => {
    expect(resolveTimes({ date: "2026-11-20" }, ctx)).toEqual({
      status: "need_time",
    });
    expect(resolveTimes({ start: "10:00" }, ctx)).toEqual({
      status: "need_date",
    });
  });

  it("creates all-day events from 00:00 UTC to the day after (spec 002 D6)", () => {
    expect(
      resolveTimes(
        { date: "2026-11-21", endDate: "2026-11-22", allDay: true },
        ctx,
      ),
    ).toEqual({
      status: "ok",
      startsAt: "2026-11-21T00:00:00.000Z",
      endsAt: "2026-11-23T00:00:00.000Z",
      allDay: true,
    });
  });

  it("follows the clock change: wall hours stay", () => {
    // 29 March 2026: Madrid goes from UTC+1 to UTC+2.
    expect(
      resolveTimes({ date: "2026-03-29", start: "10:00", end: "11:00" }, ctx),
    ).toMatchObject({
      startsAt: "2026-03-29T08:00:00.000Z",
      endsAt: "2026-03-29T09:00:00.000Z",
    });
  });

  it("rejects hours that do not exist", () => {
    expect(
      resolveTimes({ date: "2026-11-20", start: "25:00", end: "26:00" }, ctx),
    ).toEqual({ status: "invalid" });
    expect(resolveTimes({ date: "2026-02-30", start: "10:00" }, ctx)).toEqual({
      status: "invalid",
    });
  });
});

describe("resolveTimes when editing", () => {
  // Dentist on Friday 20 November, 17:00-18:00 local.
  const base = {
    startsAt: "2026-11-20T16:00:00.000Z",
    endsAt: "2026-11-20T17:00:00.000Z",
    allDay: false,
  };

  it("keeps everything when no time is asked", () => {
    expect(resolveTimes({}, { ...ctx, base })).toEqual({
      status: "ok",
      ...base,
    });
  });

  it("keeps the duration when only the start moves (RF-26)", () => {
    expect(resolveTimes({ start: "18:00" }, { ...ctx, base })).toMatchObject({
      startsAt: "2026-11-20T17:00:00.000Z",
      endsAt: "2026-11-20T18:00:00.000Z",
    });
  });

  it("keeps the hours when only the day moves (RF-26)", () => {
    expect(
      resolveTimes({ date: "2026-11-23" }, { ...ctx, base }),
    ).toMatchObject({
      startsAt: "2026-11-23T16:00:00.000Z",
      endsAt: "2026-11-23T17:00:00.000Z",
    });
  });

  it("keeps the start when only the end changes", () => {
    expect(resolveTimes({ end: "19:00" }, { ...ctx, base })).toMatchObject({
      startsAt: base.startsAt,
      endsAt: "2026-11-20T18:00:00.000Z",
    });
  });

  it("turns a timed event into an all-day one and back", () => {
    expect(resolveTimes({ allDay: true }, { ...ctx, base })).toEqual({
      status: "ok",
      startsAt: "2026-11-20T00:00:00.000Z",
      endsAt: "2026-11-21T00:00:00.000Z",
      allDay: true,
    });
    const allDay = {
      startsAt: "2026-11-20T00:00:00.000Z",
      endsAt: "2026-11-21T00:00:00.000Z",
      allDay: true,
    };
    expect(
      resolveTimes({ start: "09:00" }, { ...ctx, base: allDay }),
    ).toMatchObject({
      startsAt: "2026-11-20T08:00:00.000Z",
      endsAt: "2026-11-20T09:00:00.000Z",
      allDay: false,
    });
    expect(resolveTimes({ allDay: false }, { ...ctx, base: allDay })).toEqual({
      status: "need_time",
    });
  });

  it("moves a multi-day all-day event keeping its length", () => {
    const trip = {
      startsAt: "2026-11-21T00:00:00.000Z",
      endsAt: "2026-11-23T00:00:00.000Z",
      allDay: true,
    };
    expect(
      resolveTimes({ date: "2026-11-28" }, { ...ctx, base: trip }),
    ).toMatchObject({
      startsAt: "2026-11-28T00:00:00.000Z",
      endsAt: "2026-11-30T00:00:00.000Z",
    });
  });

  it("moves an event right after another one", () => {
    expect(resolveTimes({}, { ...ctx, base, after: PIAE })).toMatchObject({
      startsAt: "2026-11-19T12:30:00.000Z",
      endsAt: "2026-11-19T13:30:00.000Z",
    });
  });
});
