import { describe, expect, it } from "vitest";
import {
  describeAction,
  whenText,
  type ActionEvent,
  type AssistantAction,
} from "@/lib/assistant/actions";
import {
  assistantUndoSchema,
  createEventsArgsSchema,
  pendingChangeSchema,
  proposeChangesArgsSchema,
} from "@/lib/assistant/schemas";
import { WRITE_TOOL_DEFINITIONS } from "@/lib/assistant/tool-definitions";

// Spec 036, T3: what the model may ask to write and what the chat shows
// (RF-17, RF-32, RF-41; plan "Modelo de datos").
const TZ = "Europe/Madrid";
const ID = "11111111-1111-4111-8111-111111111111";
const CAL = "22222222-2222-4222-8222-222222222222";

const comida: ActionEvent = {
  id: ID,
  title: "Comida Uni",
  startsAt: "2026-11-19T12:30:00.000Z",
  endsAt: "2026-11-19T13:30:00.000Z",
  allDay: false,
  calendarName: "alexponmon@gmail.com",
  color: "#A0C4FF",
};

describe("create_events arguments", () => {
  const one = { title: "Comida Uni", after: "PIAE", end: "14:30" };

  it("takes 1 to 3 events with nulls for what was not said", () => {
    const parsed = createEventsArgsSchema.parse({
      events: [{ ...one, calendar: null, date: null }],
    });
    expect(parsed.events[0]).toMatchObject({
      title: "Comida Uni",
      after: "PIAE",
      end: "14:30",
      calendar: null,
    });
    expect(
      createEventsArgsSchema.safeParse({ events: [one, one, one] }).success,
    ).toBe(true);
  });

  it("refuses 4 or more and none (RF-41)", () => {
    expect(
      createEventsArgsSchema.safeParse({ events: [one, one, one, one] })
        .success,
    ).toBe(false);
    expect(createEventsArgsSchema.safeParse({ events: [] }).success).toBe(
      false,
    );
  });

  it("pads hours like 9:00 and refuses a title over 100 characters", () => {
    expect(
      createEventsArgsSchema.parse({ events: [{ title: "A", start: "9:00" }] })
        .events[0]!.start,
    ).toBe("09:00");
    expect(
      createEventsArgsSchema.safeParse({
        events: [{ title: "x".repeat(101) }],
      }).success,
    ).toBe(false);
  });
});

describe("propose_changes arguments", () => {
  it("names the event and only what changes", () => {
    const parsed = proposeChangesArgsSchema.parse({
      changes: [{ event: "Dentista", start: "18:00", scope: "this" }],
    });
    expect(parsed.changes[0]).toMatchObject({
      event: "Dentista",
      start: "18:00",
      scope: "this",
    });
  });

  it("refuses an unknown scope and more than 3 changes", () => {
    expect(
      proposeChangesArgsSchema.safeParse({
        changes: [{ event: "X", scope: "some" }],
      }).success,
    ).toBe(false);
    const change = { event: "X", start: "10:00" };
    expect(
      proposeChangesArgsSchema.safeParse({
        changes: [change, change, change, change],
      }).success,
    ).toBe(false);
  });
});

describe("pending change and undo from the browser", () => {
  const fields = {
    title: "PIAE",
    description: null,
    location: null,
    calendarId: CAL,
    startsAt: "2026-11-20T11:00:00.000Z",
    endsAt: "2026-11-20T12:30:00.000Z",
    allDay: false,
  };

  it("validates a pending change", () => {
    expect(
      pendingChangeSchema.safeParse({
        id: ID,
        scope: null,
        updatedAt: "2026-11-18T10:00:00.123456+00:00",
        fields,
      }).success,
    ).toBe(true);
    expect(
      pendingChangeSchema.safeParse({
        id: "not an id",
        scope: null,
        updatedAt: "x",
        fields,
      }).success,
    ).toBe(false);
    expect(
      pendingChangeSchema.safeParse({
        id: ID,
        scope: null,
        updatedAt: "x",
        fields: { ...fields, endsAt: "2026-11-20T10:00:00.000Z" },
      }).success,
    ).toBe(false);
  });

  it("accepts occurrence ids", () => {
    expect(
      pendingChangeSchema.safeParse({
        id: `${ID}_20261120T110000Z`,
        scope: "this",
        updatedAt: "x",
        fields,
      }).success,
    ).toBe(true);
  });

  it("validates both undo tokens", () => {
    expect(
      assistantUndoSchema.safeParse({
        kind: "uncreate",
        id: ID,
        updatedAt: "x",
      }).success,
    ).toBe(true);
    expect(
      assistantUndoSchema.safeParse({
        kind: "unchange",
        id: ID,
        updatedAt: "x",
        before: fields,
        series: false,
      }).success,
    ).toBe(true);
    expect(
      assistantUndoSchema.safeParse({ kind: "restore", trashId: ID }).success,
    ).toBe(false);
  });
});

describe("WRITE_TOOL_DEFINITIONS", () => {
  it("offers notes (spec 048), create_events and propose_changes", () => {
    expect(WRITE_TOOL_DEFINITIONS.map((tool) => tool.function.name)).toEqual([
      "create_notes",
      "add_note_items",
      "create_events",
      "propose_changes",
    ]);
  });
});

describe("describeAction", () => {
  it("says when an event is, in words", () => {
    expect(whenText(comida, TZ)).toBe(
      "jueves 19 de noviembre, de 13:30 a 14:30",
    );
    expect(
      whenText(
        {
          ...comida,
          startsAt: "2026-11-21T00:00:00.000Z",
          endsAt: "2026-11-23T00:00:00.000Z",
          allDay: true,
        },
        TZ,
      ),
    ).toBe("del sábado 21 al domingo 22 de noviembre, todo el día");
  });

  it("summarises a created event for the thread and screen readers (RF-32)", () => {
    const action: AssistantAction = {
      kind: "created",
      key: "a1",
      event: comida,
      undo: { kind: "uncreate", id: ID, updatedAt: "x" },
    };
    expect(describeAction(action, TZ, "done")).toBe(
      "[Evento creado: Comida Uni, jueves 19 de noviembre, de 13:30 a 14:30, en alexponmon@gmail.com]",
    );
    expect(describeAction(action, TZ, "undone")).toBe(
      "[Evento creado y deshecho: Comida Uni, jueves 19 de noviembre, de 13:30 a 14:30, en alexponmon@gmail.com]",
    );
  });

  it("summarises a change with before and after", () => {
    const action: AssistantAction = {
      kind: "change",
      key: "a2",
      before: comida,
      after: {
        ...comida,
        startsAt: "2026-11-19T13:00:00.000Z",
        endsAt: "2026-11-19T14:00:00.000Z",
      },
      scope: null,
      change: {
        id: ID,
        scope: null,
        updatedAt: "x",
        fields: {
          title: "Comida Uni",
          description: null,
          location: null,
          calendarId: CAL,
          startsAt: "2026-11-19T13:00:00.000Z",
          endsAt: "2026-11-19T14:00:00.000Z",
          allDay: false,
        },
      },
    };
    expect(describeAction(action, TZ, "pending")).toBe(
      "[Cambio pendiente de confirmar: Comida Uni, jueves 19 de noviembre, de 13:30 a 14:30 → Comida Uni, jueves 19 de noviembre, de 14:00 a 15:00, en alexponmon@gmail.com]",
    );
    expect(describeAction(action, TZ, "applied")).toMatch(
      /^\[Cambio aplicado:/,
    );
    expect(describeAction(action, TZ, "cancelled")).toMatch(
      /^\[Cambio cancelado:/,
    );
  });
});
