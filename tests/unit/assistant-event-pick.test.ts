import { describe, expect, it } from "vitest";
import { pickEvent, type PickCandidate } from "@/lib/assistant/event-pick";

// Spec 036, T2: which event "PIAE" is (RF-12 to RF-15, RF-24).
const TZ = "Europe/Madrid";
// Wednesday 18 November 2026, 10:00 in Madrid.
const NOW = new Date("2026-11-18T09:00:00Z");

const ev = (
  id: string,
  title: string,
  startsAt: string,
  endsAt: string,
  allDay = false,
): PickCandidate => ({ id, title, startsAt, endsAt, allDay });

// PIAE every Thursday 12:00-13:30 (11:00-12:30 UTC in winter).
const PIAE_LAST = ev(
  "p0",
  "PIAE",
  "2026-11-12T11:00:00Z",
  "2026-11-12T12:30:00Z",
);
const PIAE_NEXT = ev(
  "p1",
  "PIAE",
  "2026-11-19T11:00:00Z",
  "2026-11-19T12:30:00Z",
);
const PIAE_AFTER = ev(
  "p2",
  "PIAE",
  "2026-11-26T11:00:00Z",
  "2026-11-26T12:30:00Z",
);
const PIAE_EXAM = ev(
  "x1",
  "Examen PIAE",
  "2026-11-18T15:00:00Z",
  "2026-11-18T17:00:00Z",
);

const pick = (
  candidates: PickCandidate[],
  query = "PIAE",
  date: string | null = null,
  now = NOW,
) => pickEvent(candidates, { query, date, now, timeZone: TZ });

describe("pickEvent", () => {
  it("takes the next one that has not ended (RF-14)", () => {
    expect(pick([PIAE_AFTER, PIAE_LAST, PIAE_NEXT])).toEqual({
      status: "ok",
      event: PIAE_NEXT,
    });
  });

  it("prefers the exact title over one that only contains it", () => {
    expect(pick([PIAE_EXAM, PIAE_NEXT])).toEqual({
      status: "ok",
      event: PIAE_NEXT,
    });
  });

  it("ignores case and accents", () => {
    const cena = ev(
      "c1",
      "Cena en Lúa",
      "2026-11-20T19:00:00Z",
      "2026-11-20T21:00:00Z",
    );
    expect(pick([cena], "cena en lua")).toEqual({ status: "ok", event: cena });
  });

  it("takes the one of the day the user says (RF-13)", () => {
    expect(
      pick([PIAE_LAST, PIAE_NEXT, PIAE_AFTER], "PIAE", "2026-11-26"),
    ).toEqual({ status: "ok", event: PIAE_AFTER });
  });

  it("counts one going on right now as not ended", () => {
    const now = new Date("2026-11-19T12:00:00Z");
    expect(pick([PIAE_NEXT, PIAE_AFTER], "PIAE", null, now)).toEqual({
      status: "ok",
      event: PIAE_NEXT,
    });
  });

  it("asks which one when two are on the same day (RF-15)", () => {
    const evening = ev(
      "p3",
      "PIAE",
      "2026-11-19T16:00:00Z",
      "2026-11-19T17:00:00Z",
    );
    expect(pick([evening, PIAE_NEXT])).toEqual({
      status: "ambiguous",
      options: [PIAE_NEXT, evening],
    });
  });

  it("says when nothing matches (RF-15)", () => {
    expect(pick([PIAE_NEXT], "Fútbol")).toEqual({ status: "not_found" });
    expect(pick([PIAE_NEXT], "PIAE", "2026-11-20")).toEqual({
      status: "not_found",
    });
  });

  it("falls back to the latest past one when none is ahead", () => {
    expect(pick([PIAE_LAST])).toEqual({ status: "ok", event: PIAE_LAST });
  });

  it("reads an all-day event by its UTC days", () => {
    const trip = ev(
      "t1",
      "Viaje",
      "2026-11-21T00:00:00Z",
      "2026-11-23T00:00:00Z",
      true,
    );
    expect(pick([trip], "viaje", "2026-11-22")).toEqual({
      status: "ok",
      event: trip,
    });
  });
});
