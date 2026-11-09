import { describe, expect, it } from "vitest";
import { markDuplicates } from "@/lib/assistant/duplicates";
import {
  ROW_MESSAGES,
  canCreate,
  createLabel,
  rowError,
  rowInstants,
} from "@/lib/assistant/proposal-rows";
import type { ProposalRow } from "@/lib/assistant/schemas";

// Spec 022, T4: rows of a proposal and duplicates (RF-35, RF-37, RF-39,
// RF-41, RF-42).
const TZ = "Europe/Madrid";
const CAL = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const OTHER = "0c2d9a1b-1111-4c1e-9a43-2b7d7a1f0c22";

function row(over: Partial<ProposalRow> = {}): ProposalRow {
  return {
    key: "r1",
    title: "Turno",
    startDate: "2026-11-16",
    start: "08:00",
    endDate: "2026-11-16",
    end: "15:00",
    allDay: false,
    calendarId: CAL,
    selected: true,
    duplicate: false,
    ...over,
  };
}

describe("rowError (RF-35)", () => {
  it("accepts a timed row and a night shift that ends the next day", () => {
    expect(rowError(row())).toBeNull();
    expect(
      rowError(row({ start: "22:00", endDate: "2026-11-17", end: "06:00" })),
    ).toBeNull();
  });

  it("refuses an end before or equal to the start the same day", () => {
    expect(rowError(row({ end: "08:00" }))).toBe(ROW_MESSAGES.endBeforeStart);
    expect(rowError(row({ end: "07:00" }))).toBe(ROW_MESSAGES.endBeforeStart);
    expect(rowError(row({ endDate: "2026-11-15" }))).toBe(
      ROW_MESSAGES.endBeforeStart,
    );
  });

  it("asks for both hours unless it is all day", () => {
    expect(rowError(row({ start: null }))).toBe(ROW_MESSAGES.hours);
    expect(rowError(row({ allDay: true, start: null, end: null }))).toBeNull();
    expect(
      rowError(
        row({ allDay: true, start: null, end: null, endDate: "2026-11-15" }),
      ),
    ).toBe(ROW_MESSAGES.endBeforeStart);
  });

  it("asks for a title", () => {
    expect(rowError(row({ title: "  " }))).toBe(ROW_MESSAGES.title);
  });
});

describe("create button (RF-41, RF-42)", () => {
  it("counts the selected rows", () => {
    expect(createLabel(1)).toBe("Crear 1 evento");
    expect(createLabel(5)).toBe("Crear 5 eventos");
  });

  it("is disabled with no selected rows or with a selected row in error", () => {
    expect(canCreate([row({ selected: false })])).toBe(false);
    expect(canCreate([row(), row({ key: "r2", end: "07:00" })])).toBe(false);
    expect(
      canCreate([row(), row({ key: "r2", end: "07:00", selected: false })]),
    ).toBe(true);
  });
});

describe("rowInstants", () => {
  it("reads the hours in the profile zone, also across midnight", () => {
    expect(rowInstants(row(), TZ)).toEqual({
      startsAt: "2026-11-16T07:00:00.000Z",
      endsAt: "2026-11-16T14:00:00.000Z",
    });
    expect(
      rowInstants(
        row({ start: "22:00", endDate: "2026-11-17", end: "06:00" }),
        TZ,
      ),
    ).toEqual({
      startsAt: "2026-11-16T21:00:00.000Z",
      endsAt: "2026-11-17T05:00:00.000Z",
    });
  });

  it("keeps all-day rows at 00:00 UTC with an exclusive end (spec 002)", () => {
    expect(
      rowInstants(row({ allDay: true, start: null, end: null }), TZ),
    ).toEqual({
      startsAt: "2026-11-16T00:00:00.000Z",
      endsAt: "2026-11-17T00:00:00.000Z",
    });
  });
});

describe("markDuplicates (RF-37, RF-39)", () => {
  const event = {
    calendarId: CAL,
    startsAt: "2026-11-16T07:00:00.000Z",
    endsAt: "2026-11-16T14:00:00.000Z",
  };

  it("marks and unselects a row with the same calendar, start and end", () => {
    expect(markDuplicates([row()], [event], TZ)).toEqual([
      row({ duplicate: true, selected: false }),
    ]);
  });

  it("does not mark another calendar or other hours", () => {
    const rows = [row({ calendarId: OTHER }), row({ key: "r2", end: "14:00" })];
    expect(markDuplicates(rows, [event], TZ)).toEqual(rows);
  });

  it("keeps the user's choice on a duplicate they selected again (RF-38)", () => {
    const chosen = row({ duplicate: true, selected: true });
    expect(markDuplicates([chosen], [event], TZ)).toEqual([chosen]);
  });

  it("clears the mark when an edit makes it different (RF-39)", () => {
    const edited = row({ duplicate: true, selected: false, end: "16:00" });
    expect(markDuplicates([edited], [event], TZ)).toEqual([
      row({ duplicate: false, selected: false, end: "16:00" }),
    ]);
  });

  it("skips rows that are not valid yet", () => {
    const broken = row({ start: null });
    expect(markDuplicates([broken], [event], TZ)).toEqual([broken]);
  });
});
