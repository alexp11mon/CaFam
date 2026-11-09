import { describe, expect, it, vi } from "vitest";
import {
  PROPOSAL_TEXTS,
  buildProposal,
  type ProposalDeps,
} from "@/lib/assistant/proposal";
import { AssistantUnavailable } from "@/lib/assistant/provider";

// Spec 022, T5: the model's JSON checked and completed with the session
// (RF-16, RF-19, RF-21, RF-22, RF-24, RF-26 to RF-30, RF-37, RF-54).
const WORK = "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11";
const FAMILY = "0c2d9a1b-1111-4c1e-9a43-2b7d7a1f0c22";
const SHARED = "0c2d9a1b-2222-4c1e-9a43-2b7d7a1f0c33";

function deps(over: Partial<ProposalDeps> = {}): ProposalDeps {
  return {
    calendars: [
      { id: WORK, name: "Trabajo", canWrite: true },
      { id: FAMILY, name: "Familia", canWrite: true },
      { id: SHARED, name: "Turnos del equipo", canWrite: false },
    ],
    timeZone: "Europe/Madrid",
    loadEvents: vi.fn(async () => []),
    ...over,
  };
}

const json = (over: object = {}) =>
  JSON.stringify({
    question: null,
    calendar: "Trabajo",
    person: "Ana",
    unreadable: null,
    events: [
      {
        title: "Turno",
        date: "2026-11-16",
        start: "08:00",
        end: "15:00",
        endDate: null,
        allDay: false,
      },
    ],
    ...over,
  });

describe("buildProposal", () => {
  it("builds selected rows in the named writable calendar (RF-26, RF-27)", async () => {
    const result = await buildProposal(json(), deps());
    expect(result.kind).toBe("proposal");
    if (result.kind !== "proposal") return;
    expect(result.proposal.rows).toEqual([
      {
        key: "r1",
        title: "Turno",
        startDate: "2026-11-16",
        start: "08:00",
        endDate: "2026-11-16",
        end: "15:00",
        allDay: false,
        calendarId: WORK,
        selected: true,
        duplicate: false,
      },
    ]);
    expect(result.proposal.omitted).toBe(0);
    expect(result.text).toBe("He leído 1 evento. Revísalo y pulsa «Crear».");
  });

  it("returns the model's question without a proposal (RF-24, RF-20b)", async () => {
    const result = await buildProposal(
      json({ question: "¿De qué semana es el horario?", events: [] }),
      deps(),
    );
    expect(result).toEqual({
      kind: "message",
      text: "¿De qué semana es el horario?",
    });
  });

  it("asks for the calendar when none is named (RF-28)", async () => {
    const result = await buildProposal(json({ calendar: null }), deps());
    expect(result).toEqual({
      kind: "message",
      text: "¿En qué calendario creo los eventos? Puedes elegir: Familia, Trabajo.",
    });
  });

  it("says why a calendar does not work and offers the writable ones (RF-29)", async () => {
    expect(await buildProposal(json({ calendar: "Gimnasio" }), deps())).toEqual(
      {
        kind: "message",
        text: "No encuentro el calendario «Gimnasio». Puedes crear eventos en: Familia, Trabajo.",
      },
    );
    expect(
      await buildProposal(json({ calendar: "turnos del equipo" }), deps()),
    ).toEqual({
      kind: "message",
      text: "No puedes crear eventos en «Turnos del equipo». Puedes crear eventos en: Familia, Trabajo.",
    });
  });

  it("asks which one when the name matches several (RF-30)", async () => {
    const two = deps({
      calendars: [
        { id: WORK, name: "Trabajo Ana", canWrite: true },
        { id: FAMILY, name: "Trabajo Luis", canWrite: true },
      ],
    });
    expect(await buildProposal(json({ calendar: "trabajo" }), two)).toEqual({
      kind: "message",
      text: "¿En cuál de estos calendarios? Trabajo Ana, Trabajo Luis.",
    });
  });

  it("says when there is nothing it can write to", async () => {
    const none = deps({
      calendars: [{ id: SHARED, name: "Turnos", canWrite: false }],
    });
    expect(await buildProposal(json(), none)).toEqual({
      kind: "message",
      text: PROPOSAL_TEXTS.noWritable,
    });
  });

  it("says when no schedule was found (RF-50)", async () => {
    expect(await buildProposal(json({ events: [] }), deps())).toEqual({
      kind: "message",
      text: PROPOSAL_TEXTS.nothingFound,
    });
  });

  it("names untitled events «Trabajo» and pads hours (RF-16)", async () => {
    const result = await buildProposal(
      json({
        events: [
          { title: " ", date: "2026-11-16", start: "8:00", end: "9:30" },
        ],
      }),
      deps(),
    );
    expect(result.kind === "proposal" && result.proposal.rows[0]).toMatchObject(
      { title: "Trabajo", start: "08:00", end: "09:30" },
    );
  });

  it("makes a night shift end the next day even without endDate (RF-18)", async () => {
    const result = await buildProposal(
      json({
        events: [
          { title: "Noche", date: "2026-11-21", start: "22:00", end: "06:00" },
        ],
      }),
      deps(),
    );
    expect(result.kind === "proposal" && result.proposal.rows[0]).toMatchObject(
      { startDate: "2026-11-21", endDate: "2026-11-22" },
    );
  });

  it("treats events without hours as all day", async () => {
    const result = await buildProposal(
      json({ events: [{ title: "Curso", date: "2026-11-16" }] }),
      deps(),
    );
    expect(result.kind === "proposal" && result.proposal.rows[0]).toMatchObject(
      { allDay: true, start: null, end: null, endDate: "2026-11-16" },
    );
  });

  it("sorts by date, drops repeated rows and keeps 50, counting the rest (RF-21, RF-22)", async () => {
    const events = Array.from({ length: 60 }, (_, i) => ({
      title: "Turno",
      date: `2026-12-${String(31 - (i % 31)).padStart(2, "0")}`,
      start: i < 31 ? "08:00" : "16:00",
      end: i < 31 ? "15:00" : "20:00",
    }));
    events.push({ ...events[0]! });
    const result = await buildProposal(json({ events }), deps());
    if (result.kind !== "proposal") throw new Error(result.kind);
    expect(result.proposal.rows).toHaveLength(50);
    expect(result.proposal.omitted).toBe(10);
    expect(result.proposal.rows[0]).toMatchObject({
      startDate: "2026-12-01",
      start: "08:00",
    });
    expect(result.text).toContain(
      "He dejado fuera 10 eventos: como mucho propongo 50.",
    );
  });

  it("marks duplicates with the events of the range (RF-37)", async () => {
    const loadEvents = vi.fn(async () => [
      {
        calendarId: WORK,
        startsAt: "2026-11-16T07:00:00.000Z",
        endsAt: "2026-11-16T14:00:00.000Z",
      },
    ]);
    const result = await buildProposal(json(), deps({ loadEvents }));
    expect(result.kind === "proposal" && result.proposal.rows[0]).toMatchObject(
      { duplicate: true, selected: false },
    );
    const [from, to] = loadEvents.mock.calls[0] as unknown as [Date, Date];
    expect(from.getTime()).toBeLessThan(Date.parse("2026-11-16T07:00:00Z"));
    expect(to.getTime()).toBeGreaterThan(Date.parse("2026-11-16T14:00:00Z"));
  });

  it("says what it could not read (RF-51)", async () => {
    const result = await buildProposal(
      json({ unreadable: "el jueves, la foto está borrosa" }),
      deps(),
    );
    expect(result.kind === "proposal" && result.text).toContain(
      "No he podido leer: el jueves, la foto está borrosa.",
    );
  });

  it("keeps each row's own calendar in a correction (RF-33, RF-36)", async () => {
    const result = await buildProposal(
      json({
        events: [
          {
            title: "A",
            date: "2026-11-16",
            start: "08:00",
            end: "09:00",
            calendar: "Familia",
          },
          {
            title: "B",
            date: "2026-11-17",
            start: "08:00",
            end: "09:00",
            calendar: "Turnos del equipo",
          },
        ],
      }),
      deps(),
    );
    if (result.kind !== "proposal") throw new Error(result.kind);
    // A calendar the user cannot write to falls back to the named one.
    expect(result.proposal.rows.map((row) => row.calendarId)).toEqual([
      FAMILY,
      WORK,
    ]);
  });

  it("treats JSON that does not validate as the provider failing (RF-54)", async () => {
    for (const bad of [
      "no es json",
      JSON.stringify({ events: [{ date: "16/11/2026" }] }),
      JSON.stringify({ events: "x" }),
    ]) {
      await expect(buildProposal(bad, deps())).rejects.toBeInstanceOf(
        AssistantUnavailable,
      );
    }
  });
});
