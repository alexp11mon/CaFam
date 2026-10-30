// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  planSeriesChange,
  planSeriesDelete,
  type SeriesChangeInput,
} from "@/lib/recurrence/series-write";

// Spec 013, T12: which function each scope calls and with what (RF-15 to
// RF-19, RF-21, RF-23, plan D10 to D12).
const SERIES = {
  id: "s1",
  // Every Wednesday at 18:00 in Madrid since 7 October 2026.
  recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE",
  recurrenceTz: "Europe/Madrid",
  startsAt: "2026-10-07T16:00:00.000Z",
  endsAt: "2026-10-07T17:00:00.000Z",
  allDay: false,
  originalStart: "2026-11-11T17:00:00.000Z",
};

// The occurrence of 11 November (winter time: 18:00 is 17:00 UTC).
const OCCURRENCE = {
  calendarId: "cal",
  startsAt: "2026-11-11T17:00:00.000Z",
  endsAt: "2026-11-11T18:00:00.000Z",
  allDay: false,
};

const ROW = {
  calendar_id: "cal",
  title: "Natación",
  description: null,
  location: null,
  starts_at: OCCURRENCE.startsAt,
  ends_at: OCCURRENCE.endsAt,
  all_day: false,
  color: null,
  category_id: null,
};

const SAME = `custom:${SERIES.recurrence}`;

function plan(overrides: Partial<SeriesChangeInput>) {
  return planSeriesChange({
    series: SERIES,
    occurrence: OCCURRENCE,
    row: ROW,
    repeat: SAME,
    startDate: "2026-11-11",
    scope: "this",
    timeZone: "Europe/Madrid",
    ...overrides,
  });
}

describe("planSeriesChange: Solo este evento (RF-16)", () => {
  it("changes the occurrence without its calendar", () => {
    const result = plan({ row: { ...ROW, title: "Natación libre" } });
    expect(result).toEqual({
      kind: "rpc",
      fn: "update_occurrence",
      args: {
        p_series_id: "s1",
        p_original_start: SERIES.originalStart,
        p_fields: expect.not.objectContaining({ calendar_id: "cal" }),
      },
      loss: null,
    });
    if (result.kind === "rpc") {
      expect(result.args.p_fields).toMatchObject({ title: "Natación libre" });
    }
  });

  it("refuses another calendar (D10) or another rule", () => {
    expect(plan({ row: { ...ROW, calendar_id: "other" } })).toEqual({
      kind: "error",
      message:
        "Para cambiar de calendario, elige «Todos los eventos» o «Este y los siguientes».",
    });
    expect(plan({ repeat: "daily" })).toMatchObject({ kind: "error" });
  });
});

describe("planSeriesChange: Todos los eventos (RF-18, RF-19, RF-21, RF-23)", () => {
  it("keeps the exceptions when only the title or the calendar changes", () => {
    const result = plan({
      scope: "all",
      row: { ...ROW, title: "Piscina", calendar_id: "other" },
    });
    expect(result).toMatchObject({
      kind: "rpc",
      fn: "update_series",
      args: {
        p_series_id: "s1",
        p_drop_exceptions: false,
        p_fields: {
          title: "Piscina",
          calendar_id: "other",
          starts_at: SERIES.startsAt,
          ends_at: SERIES.endsAt,
        },
      },
      loss: null,
    });
  });

  it("shifts the exceptions when only the hour changes (D12)", () => {
    const result = plan({
      scope: "all",
      row: {
        ...ROW,
        starts_at: "2026-11-11T18:30:00.000Z",
        ends_at: "2026-11-11T19:30:00.000Z",
      },
    });
    expect(result).toMatchObject({
      fn: "update_series",
      args: {
        p_shift: "5400 seconds",
        p_drop_exceptions: false,
        p_fields: {
          starts_at: "2026-10-07T17:30:00.000Z",
          ends_at: "2026-10-07T18:30:00.000Z",
        },
      },
      loss: null,
    });
  });

  it("drops the exceptions, with a warning, when the rule changes (RF-19)", () => {
    const result = plan({ scope: "all", repeat: "daily" });
    expect(result).toMatchObject({
      fn: "update_series",
      args: {
        p_drop_exceptions: true,
        p_fields: { recurrence: "FREQ=DAILY;INTERVAL=1" },
      },
      loss: {},
    });
  });

  it("drops them when the start date changes (RF-19)", () => {
    const result = plan({
      scope: "all",
      startDate: "2026-11-12",
      row: {
        ...ROW,
        starts_at: "2026-11-12T17:00:00.000Z",
        ends_at: "2026-11-12T18:00:00.000Z",
      },
    });
    expect(result).toMatchObject({
      args: { p_drop_exceptions: true },
      loss: {},
    });
  });

  it("'No se repite' leaves the first occurrence as a single event (RF-21)", () => {
    const result = plan({ scope: "all", repeat: "none" });
    expect(result).toMatchObject({
      fn: "update_series",
      args: {
        p_fields: {
          recurrence: null,
          recurrence_tz: null,
          recurrence_until: null,
          starts_at: SERIES.startsAt,
        },
      },
      loss: { from: "2026-10-07T16:00:01.000Z" },
    });
  });

  it("a rule without occurrences is refused next to the field (RF-8)", () => {
    expect(
      plan({
        scope: "all",
        repeat: "custom:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;UNTIL=20261011T235959",
      }),
    ).toEqual({
      kind: "error",
      field: "repeat",
      message: "Con este final la serie no tiene ninguna repetición.",
    });
  });
});

describe("planSeriesChange: Este y los siguientes (RF-17, D11)", () => {
  it("splits keeping the later exceptions when rule and start stay", () => {
    const result = plan({
      scope: "following",
      row: { ...ROW, title: "Piscina" },
    });
    expect(result).toMatchObject({
      kind: "rpc",
      fn: "split_series",
      args: {
        p_series_id: "s1",
        p_original_start: SERIES.originalStart,
        p_old_recurrence:
          "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;UNTIL=20261110T235959",
        p_old_until: "2026-11-04T18:00:00.000Z",
        p_keep_exceptions: true,
        p_new: {
          title: "Piscina",
          recurrence: SERIES.recurrence,
          recurrence_tz: "Europe/Madrid",
          starts_at: OCCURRENCE.startsAt,
        },
      },
      loss: null,
    });
  });

  it("keeps the count left for the new series", () => {
    const result = plan({
      scope: "following",
      series: { ...SERIES, recurrence: `${SERIES.recurrence};COUNT=10` },
      repeat: `custom:${SERIES.recurrence};COUNT=10`,
    });
    expect(result).toMatchObject({
      args: {
        p_old_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;COUNT=5",
        p_new: { recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;COUNT=5" },
      },
    });
  });

  it("drops the later exceptions, with a warning, when the hour changes", () => {
    const result = plan({
      scope: "following",
      row: {
        ...ROW,
        starts_at: "2026-11-11T18:00:00.000Z",
        ends_at: "2026-11-11T19:00:00.000Z",
      },
    });
    expect(result).toMatchObject({
      args: { p_keep_exceptions: false },
      loss: { from: SERIES.originalStart },
    });
  });

  it("from the first occurrence it is the whole series", () => {
    const result = plan({
      scope: "following",
      occurrence: {
        ...OCCURRENCE,
        startsAt: SERIES.startsAt,
        endsAt: SERIES.endsAt,
      },
      series: { ...SERIES, originalStart: SERIES.startsAt },
      startDate: "2026-10-07",
      row: { ...ROW, starts_at: SERIES.startsAt, ends_at: SERIES.endsAt },
    });
    expect(result).toMatchObject({ fn: "update_series" });
  });
});

describe("planSeriesDelete (RF-20, RF-24b)", () => {
  it("'Solo este evento' counts only its own images", () => {
    expect(planSeriesDelete(SERIES, "this")).toEqual({
      args: {
        p_series_id: "s1",
        p_original_start: SERIES.originalStart,
        p_scope: "this",
        p_recurrence: null,
        p_until: null,
      },
      loss: { only: SERIES.originalStart },
    });
  });

  it("'Este y los siguientes' ends the series the day before", () => {
    expect(planSeriesDelete(SERIES, "following")).toEqual({
      args: {
        p_series_id: "s1",
        p_original_start: SERIES.originalStart,
        p_scope: "following",
        p_recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE;UNTIL=20261110T235959",
        p_until: "2026-11-04T18:00:00.000Z",
      },
      loss: { from: SERIES.originalStart },
    });
  });

  it("from the first occurrence or with 'Todos' it deletes all", () => {
    const first = { ...SERIES, originalStart: SERIES.startsAt };
    expect(planSeriesDelete(first, "following")).toMatchObject({
      args: { p_recurrence: null },
      loss: {},
    });
    expect(planSeriesDelete(SERIES, "all")).toMatchObject({
      args: { p_scope: "all" },
      loss: {},
    });
  });
});
