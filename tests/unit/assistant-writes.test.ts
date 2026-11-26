// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAction } from "@/lib/assistant/actions";
import { createRefs } from "@/lib/assistant/citations";
import type { CitedEvent } from "@/lib/assistant/tools";
import type { CalendarRecord } from "@/lib/calendar/queries";

// Spec 036, T4: creating events from the chat with the user's session
// (RF-1 to RF-23, RF-39, RF-41, RF-42, RF-44; plan D1, D3). The writes
// themselves are those of the form, mocked here and tested against the
// database in tests/integration/assistant-writes.test.ts.

const mocks = vi.hoisted(() => ({
  getMyCalendars: vi.fn(),
  getViewOptions: vi.fn(),
  getEvent: vi.fn(),
  findEventsByTitle: vi.fn(),
  createSingle: vi.fn(),
  updatedAtOf: vi.fn(),
  seriesLoss: vi.fn(),
}));

vi.mock("@/lib/calendar/queries", async (actual) => ({
  ...(await actual<object>()),
  getMyCalendars: mocks.getMyCalendars,
  getViewOptions: mocks.getViewOptions,
  getEvent: mocks.getEvent,
}));
vi.mock("@/lib/assistant/tools", async (actual) => ({
  ...(await actual<object>()),
  findEventsByTitle: mocks.findEventsByTitle,
}));
vi.mock("@/app/dashboard/events/event-writes", async (actual) => ({
  ...(await actual<object>()),
  createSingle: mocks.createSingle,
  unconfirmedLoss: mocks.seriesLoss,
}));
vi.mock("@/app/dashboard/events/quick-writes", async (actual) => ({
  ...(await actual<object>()),
  updatedAtOf: mocks.updatedAtOf,
}));

const { writeTools } =
  await import("@/app/dashboard/assistant/assistant-writes");

const TZ = "Europe/Madrid";
const NOW = new Date("2026-11-18T09:00:00Z");
const NEW_ID = "33333333-3333-4333-8333-333333333333";

function calendar(
  id: string,
  name: string,
  over: Partial<CalendarRecord> = {},
): CalendarRecord {
  return {
    id,
    name,
    description: null,
    color: "#A0C4FF",
    ownerId: "u1",
    createdAt: "2026-01-01T00:00:00Z",
    role: "owner",
    synced: null,
    ...over,
  };
}

const GOOGLE = calendar("c-google", "alexponmon@gmail.com", {
  synced: {
    lastSyncedAt: null,
    accountEmail: "alexponmon@gmail.com",
    connectionId: "conn",
    canWrite: true,
    googleAccess: "owner",
    provider: "google",
  },
});
const UNI = calendar("c-uni", "Uni");
const ANA = calendar("c-ana", "Trabajo de Ana", { role: "viewer" });

const PIAE = {
  id: "p1",
  calendarId: "c-uni",
  title: "PIAE",
  startsAt: "2026-11-19T11:00:00.000Z",
  endsAt: "2026-11-19T12:30:00.000Z",
  allDay: false,
  location: null,
};

function setup(signal?: AbortSignal) {
  const actions: AssistantAction[] = [];
  const refs = createRefs<CitedEvent>();
  const tools = writeTools({
    supabase: {} as never,
    userId: "u1",
    timeZone: TZ,
    now: NOW,
    refs,
    signal,
    onAction: (action) => actions.push(action),
  });
  return { tools, actions, refs };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMyCalendars.mockResolvedValue([GOOGLE, UNI, ANA]);
  mocks.getViewOptions.mockResolvedValue({ showWeekends: true, duration: 60 });
  mocks.findEventsByTitle.mockResolvedValue([PIAE]);
  mocks.createSingle.mockResolvedValue({ ok: true, id: NEW_ID });
  mocks.updatedAtOf.mockResolvedValue("2026-11-18T09:00:01+00:00");
  mocks.seriesLoss.mockResolvedValue(null);
});

describe("create_events", () => {
  it("creates the user's example: after PIAE until 14:30, in the Google calendar", async () => {
    const { tools, actions } = setup();
    const result = await tools.create_events({
      events: [
        {
          title: "Comida Uni",
          calendar: "alexponmon@gmail.com",
          after: "PIAE",
          end: "14:30",
        },
      ],
    });

    expect(mocks.createSingle).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({
        calendar_id: "c-google",
        title: "Comida Uni",
        starts_at: "2026-11-19T12:30:00.000Z",
        ends_at: "2026-11-19T13:30:00.000Z",
        all_day: false,
      }),
    );
    expect(mocks.findEventsByTitle).toHaveBeenCalledWith(
      expect.anything(),
      "PIAE",
      NOW,
      TZ,
    );
    expect(result).toMatchObject({
      status: "created",
      ref: "e1",
      title: "Comida Uni",
      date: "2026-11-19",
      start: "13:30",
      end: "14:30",
      calendar: "alexponmon@gmail.com",
      anchor: { title: "PIAE", start: "12:00", end: "13:30" },
    });
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "created",
        event: expect.objectContaining({
          id: NEW_ID,
          title: "Comida Uni",
          calendarName: "alexponmon@gmail.com",
        }),
        anchor: expect.objectContaining({ title: "PIAE" }),
        undo: {
          kind: "uncreate",
          id: NEW_ID,
          updatedAt: "2026-11-18T09:00:01+00:00",
        },
      }),
    ]);
  });

  it("creates with fixed hours and no reference event", async () => {
    const { tools } = setup();
    await tools.create_events({
      events: [
        {
          title: "Dentista",
          calendar: "uni",
          date: "2026-11-20",
          start: "17:00",
        },
      ],
    });
    expect(mocks.findEventsByTitle).not.toHaveBeenCalled();
    expect(mocks.createSingle).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({
        calendar_id: "c-uni",
        starts_at: "2026-11-20T16:00:00.000Z",
        ends_at: "2026-11-20T17:00:00.000Z",
      }),
    );
  });

  it("refuses a calendar the user only reads, with its reason (RF-23)", async () => {
    const { tools, actions } = setup();
    const result = await tools.create_events({
      events: [
        {
          title: "Turno",
          calendar: "Trabajo de Ana",
          date: "2026-11-20",
          start: "08:00",
        },
      ],
    });
    expect(result).toMatchObject({
      status: "read_only",
      notice:
        "No puedes crear eventos en «Trabajo de Ana»: solo puedes verlo. Puedes crear eventos en: alexponmon@gmail.com, Uni.",
    });
    expect(mocks.createSingle).not.toHaveBeenCalled();
    expect(actions).toEqual([]);
  });

  it("asks which calendar when none is named (RF-21)", async () => {
    const { tools } = setup();
    expect(
      await tools.create_events({
        events: [{ title: "X", date: "2026-11-20", start: "08:00" }],
      }),
    ).toEqual({
      status: "need_calendar",
      options: ["alexponmon@gmail.com", "Uni"],
    });
  });

  it("asks which reference event when two are the same day (RF-15)", async () => {
    mocks.findEventsByTitle.mockResolvedValue([
      PIAE,
      {
        ...PIAE,
        id: "p2",
        startsAt: "2026-11-19T16:00:00.000Z",
        endsAt: "2026-11-19T17:00:00.000Z",
      },
    ]);
    const { tools } = setup();
    expect(
      await tools.create_events({
        events: [{ title: "Comida", calendar: "Uni", after: "PIAE" }],
      }),
    ).toEqual({
      status: "ambiguous_event",
      title: "PIAE",
      options: [
        "PIAE, jueves 19 de noviembre, de 12:00 a 13:30",
        "PIAE, jueves 19 de noviembre, de 17:00 a 18:00",
      ],
    });
    expect(mocks.createSingle).not.toHaveBeenCalled();
  });

  it("says when the reference event is not found (RF-15)", async () => {
    mocks.findEventsByTitle.mockResolvedValue([]);
    const { tools } = setup();
    expect(
      await tools.create_events({
        events: [{ title: "Comida", calendar: "Uni", after: "PIAE" }],
      }),
    ).toEqual({ status: "event_not_found", title: "PIAE" });
  });

  it("refuses an end before the start with both hours (RF-8)", async () => {
    const { tools } = setup();
    expect(
      await tools.create_events({
        events: [
          { title: "Comida", calendar: "Uni", after: "PIAE", end: "13:00" },
        ],
      }),
    ).toEqual({
      status: "end_before_start",
      notice:
        "La hora de fin (13:00) no es posterior a la de inicio (13:30): no he creado «Comida».",
    });
  });

  it("creates none of 4 events (RF-41)", async () => {
    const { tools } = setup();
    const one = {
      title: "X",
      calendar: "Uni",
      date: "2026-11-20",
      start: "08:00",
    };
    expect(
      await tools.create_events({ events: [one, one, one, one] }),
    ).toMatchObject({ status: "too_many" });
    expect(mocks.createSingle).not.toHaveBeenCalled();
  });

  it("counts every write of the question: a second call past 3 is refused", async () => {
    const { tools } = setup();
    const one = {
      title: "X",
      calendar: "Uni",
      date: "2026-11-20",
      start: "08:00",
    };
    await tools.create_events({ events: [one, one] });
    expect(await tools.create_events({ events: [one, one] })).toMatchObject({
      status: "too_many",
    });
    expect(mocks.createSingle).toHaveBeenCalledTimes(2);
  });

  it("does not write once the user cancelled (RF-44)", async () => {
    const controller = new AbortController();
    controller.abort();
    const { tools } = setup(controller.signal);
    expect(
      await tools.create_events({
        events: [
          { title: "X", calendar: "Uni", date: "2026-11-20", start: "08:00" },
        ],
      }),
    ).toEqual({ status: "cancelled" });
    expect(mocks.createSingle).not.toHaveBeenCalled();
  });

  it("never says it was created when the provider refuses it (RF-42)", async () => {
    mocks.createSingle.mockResolvedValue({
      ok: false,
      error: "Google no ha aceptado el cambio.",
    });
    const { tools, actions } = setup();
    expect(
      await tools.create_events({
        events: [
          {
            title: "Comida",
            calendar: "alexponmon@gmail.com",
            date: "2026-11-20",
            start: "14:00",
          },
        ],
      }),
    ).toEqual({
      status: "failed",
      notice: "No he podido crear «Comida»: Google no ha aceptado el cambio.",
    });
    expect(actions).toEqual([]);
  });

  it("answers each event of a call, in order", async () => {
    const { tools, actions } = setup();
    const result = await tools.create_events({
      events: [
        { title: "A", calendar: "Uni", date: "2026-11-20", start: "08:00" },
        {
          title: "B",
          calendar: "Gimnasio",
          date: "2026-11-20",
          start: "09:00",
        },
      ],
    });
    expect(result).toMatchObject({
      results: [
        { status: "created", title: "A" },
        { status: "calendar_not_found", name: "Gimnasio" },
      ],
    });
    expect(actions).toHaveLength(1);
  });

  it("asks the hour of a day without hours (RF-5)", async () => {
    const { tools } = setup();
    expect(
      await tools.create_events({
        events: [{ title: "Cena", calendar: "Uni", date: "2026-11-20" }],
      }),
    ).toEqual({ status: "need_time" });
  });

  it("answers invalid_arguments to a malformed call", async () => {
    const { tools } = setup();
    expect(await tools.create_events({ events: "nope" })).toEqual({
      status: "invalid_arguments",
    });
  });
});

// Spec 036, T5: changes are prepared, never written in the loop (RF-24 to
// RF-30; plan D4, D7, D9).
describe("propose_changes", () => {
  const DENTISTA = {
    id: "d1",
    rowId: "d1",
    calendarId: "c-uni",
    title: "Dentista",
    description: null,
    location: "Clínica",
    startsAt: "2026-11-20T16:00:00.000Z",
    endsAt: "2026-11-20T17:00:00.000Z",
    allDay: false,
    color: null,
    categoryId: null,
    createdBy: "u1",
    series: null,
  };

  beforeEach(() => {
    mocks.findEventsByTitle.mockResolvedValue([
      {
        id: "d1",
        calendarId: "c-uni",
        title: "Dentista",
        startsAt: DENTISTA.startsAt,
        endsAt: DENTISTA.endsAt,
        allDay: false,
        location: "Clínica",
      },
    ]);
    mocks.getEvent.mockResolvedValue(DENTISTA);
    mocks.updatedAtOf.mockResolvedValue("2026-11-18T08:00:00+00:00");
  });

  it("prepares the change keeping the duration, and writes nothing (RF-24, RF-26)", async () => {
    const { tools, actions } = setup();
    const result = await tools.propose_changes({
      changes: [{ event: "Dentista", start: "18:00" }],
    });
    expect(mocks.createSingle).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "proposed",
      title: "Dentista",
      before: { date: "2026-11-20", start: "17:00", end: "18:00" },
      after: { date: "2026-11-20", start: "18:00", end: "19:00" },
    });
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "change",
        before: expect.objectContaining({ title: "Dentista" }),
        after: expect.objectContaining({
          startsAt: "2026-11-20T17:00:00.000Z",
          endsAt: "2026-11-20T18:00:00.000Z",
          calendarName: "Uni",
          location: "Clínica",
        }),
        scope: null,
        change: {
          id: "d1",
          scope: null,
          updatedAt: "2026-11-18T08:00:00+00:00",
          fields: {
            title: "Dentista",
            description: null,
            location: "Clínica",
            calendarId: "c-uni",
            startsAt: "2026-11-20T17:00:00.000Z",
            endsAt: "2026-11-20T18:00:00.000Z",
            allDay: false,
          },
        },
      }),
    ]);
  });

  it("changes the title and moves to another calendar it may go to (RF-25, RF-27)", async () => {
    const { tools, actions } = setup();
    await tools.propose_changes({
      changes: [{ event: "Dentista", title: "Dentista Ana", calendar: "Uni" }],
    });
    expect(actions[0]).toMatchObject({
      change: { fields: { title: "Dentista Ana", calendarId: "c-uni" } },
    });
  });

  it("refuses a destination of another kind: Google from a normal calendar (RF-27)", async () => {
    const { tools, actions } = setup();
    expect(
      await tools.propose_changes({
        changes: [{ event: "Dentista", calendar: "alexponmon@gmail.com" }],
      }),
    ).toMatchObject({ status: "cannot_move" });
    expect(actions).toEqual([]);
  });

  it("refuses an event the user only reads (RF-28)", async () => {
    mocks.getEvent.mockResolvedValue({ ...DENTISTA, calendarId: "c-ana" });
    const { tools, actions } = setup();
    expect(
      await tools.propose_changes({
        changes: [{ event: "Dentista", start: "18:00" }],
      }),
    ).toEqual({
      status: "forbidden",
      notice: "No puedes cambiar «Dentista»: solo puedes ver «Trabajo de Ana».",
    });
    expect(actions).toEqual([]);
  });

  it("says when nothing would change", async () => {
    const { tools } = setup();
    expect(
      await tools.propose_changes({
        changes: [{ event: "Dentista", start: "17:00" }],
      }),
    ).toEqual({ status: "no_change" });
  });

  it("changes only this occurrence of a series unless told otherwise (RF-29)", async () => {
    mocks.getEvent.mockResolvedValue({
      ...DENTISTA,
      id: "s1_20261120T160000Z",
      rowId: null,
      series: {
        id: "s1",
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
        recurrenceTz: TZ,
        summary: "Cada semana el viernes",
        originalStart: DENTISTA.startsAt,
        changed: false,
        exceptions: 0,
        startsAt: "2026-11-06T16:00:00.000Z",
        endsAt: "2026-11-06T17:00:00.000Z",
        allDay: false,
      },
    });
    const { tools, actions } = setup();
    const result = await tools.propose_changes({
      changes: [{ event: "Dentista", start: "18:00" }],
    });
    expect(result).toMatchObject({ status: "proposed" });
    // The occurrence has no row yet: its series' updated_at guards it (D7).
    expect(mocks.updatedAtOf).toHaveBeenCalledWith(expect.anything(), "s1");
    expect(actions[0]).toMatchObject({
      scope: "this",
      change: { id: "s1_20261120T160000Z", scope: "this" },
    });
  });

  it("asks which event when two are the same day", async () => {
    mocks.findEventsByTitle.mockResolvedValue([
      {
        id: "d1",
        calendarId: "c-uni",
        title: "Dentista",
        startsAt: DENTISTA.startsAt,
        endsAt: DENTISTA.endsAt,
        allDay: false,
        location: null,
      },
      {
        id: "d2",
        calendarId: "c-uni",
        title: "Dentista",
        startsAt: "2026-11-20T08:00:00.000Z",
        endsAt: "2026-11-20T09:00:00.000Z",
        allDay: false,
        location: null,
      },
    ]);
    const { tools } = setup();
    expect(
      await tools.propose_changes({
        changes: [{ event: "Dentista", start: "18:00" }],
      }),
    ).toMatchObject({ status: "ambiguous_event" });
  });

  it("shares the limit of 3 writes with create_events (RF-41)", async () => {
    const { tools } = setup();
    const one = {
      title: "X",
      calendar: "Uni",
      date: "2026-11-20",
      start: "08:00",
    };
    await tools.create_events({ events: [one, one] });
    expect(
      await tools.propose_changes({
        changes: [
          { event: "Dentista", start: "18:00" },
          { event: "Dentista", start: "19:00" },
        ],
      }),
    ).toMatchObject({ status: "too_many" });
  });
});

// Spec 052 T2, T3: deleting and series are proposed on a card; nothing is
// written until the user confirms (RF-1 to RF-7).
describe("propose_deletes", () => {
  const CENA = {
    id: "c1",
    rowId: "c1",
    calendarId: "c-uni",
    title: "Cena",
    description: null,
    location: null,
    startsAt: "2026-11-20T19:00:00.000Z",
    endsAt: "2026-11-20T21:00:00.000Z",
    allDay: false,
    color: null,
    categoryId: null,
    createdBy: "u1",
    series: null,
  };

  beforeEach(() => {
    mocks.findEventsByTitle.mockResolvedValue([
      {
        id: "c1",
        calendarId: "c-uni",
        title: "Cena",
        startsAt: CENA.startsAt,
        endsAt: CENA.endsAt,
        allDay: false,
        location: null,
      },
    ]);
    mocks.getEvent.mockResolvedValue(CENA);
    mocks.updatedAtOf.mockResolvedValue("2026-11-18T08:00:00+00:00");
  });

  it("proposes the deletion and deletes nothing (RF-1, RF-2)", async () => {
    const { tools, actions } = setup();
    const result = await tools.propose_deletes({
      deletes: [{ event: "Cena" }],
    });
    expect(result).toMatchObject({
      status: "proposed_delete",
      title: "Cena",
      date: "2026-11-20",
      start: "20:00",
      calendar: "Uni",
    });
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "delete",
        event: expect.objectContaining({ title: "Cena", calendarName: "Uni" }),
        scope: null,
        remove: {
          id: "c1",
          scope: null,
          updatedAt: "2026-11-18T08:00:00+00:00",
        },
      }),
    ]);
    expect(mocks.createSingle).not.toHaveBeenCalled();
  });

  it("explains a calendar the user only reads, without a card (RF-4)", async () => {
    mocks.getEvent.mockResolvedValue({ ...CENA, calendarId: "c-ana" });
    const { tools, actions } = setup();
    expect(
      await tools.propose_deletes({ deletes: [{ event: "Cena" }] }),
    ).toEqual({
      status: "forbidden",
      notice: "No puedes borrar «Cena»: solo puedes ver «Trabajo de Ana».",
    });
    expect(actions).toEqual([]);
  });

  it("shows the scope and the loss of a series (RF-2)", async () => {
    mocks.getEvent.mockResolvedValue({
      ...CENA,
      id: "s1_20261120T190000Z",
      rowId: null,
      series: {
        id: "s1",
        recurrence: "FREQ=WEEKLY;INTERVAL=1;BYDAY=FR",
        recurrenceTz: TZ,
        summary: "Cada semana el viernes",
        originalStart: CENA.startsAt,
        changed: false,
        exceptions: 0,
        startsAt: "2026-11-06T19:00:00.000Z",
        endsAt: "2026-11-06T21:00:00.000Z",
        allDay: false,
      },
    });
    mocks.seriesLoss.mockResolvedValue({ images: 3, comments: 2 });
    const { tools, actions } = setup();
    await tools.propose_deletes({ deletes: [{ event: "Cena", scope: "all" }] });
    expect(mocks.updatedAtOf).toHaveBeenCalledWith(expect.anything(), "s1");
    expect(actions[0]).toMatchObject({
      kind: "delete",
      scope: "all",
      loss: { images: 3, comments: 2 },
      remove: { id: "s1_20261120T190000Z", scope: "all" },
    });
  });

  it("refuses more than 3 (RF-1)", async () => {
    const { tools, actions } = setup();
    expect(
      await tools.propose_deletes({
        deletes: [1, 2, 3, 4].map(() => ({ event: "Cena" })),
      }),
    ).toMatchObject({ status: "too_many" });
    expect(actions).toEqual([]);
  });
});

describe("propose_series", () => {
  it("proposes the series with its rule in words and 3 dates (RF-5, RF-6)", async () => {
    const { tools, actions } = setup();
    const result = await tools.propose_series({
      series: [
        {
          title: "Inglés",
          calendar: "Uni",
          date: "2026-11-18",
          start: "18:00",
          freq: "weekly",
          byDay: ["TU"],
          until: "2027-06-30",
        },
      ],
    });
    expect(result).toMatchObject({
      status: "proposed_series",
      rule: "Cada semana el martes, hasta el 30 de junio de 2027",
      // 2026-11-18 is a Wednesday: the series starts the next Tuesday.
      first: { date: "2026-11-24", start: "18:00", end: "19:00" },
    });
    expect(actions).toEqual([
      expect.objectContaining({
        kind: "series",
        summary: "Cada semana el martes, hasta el 30 de junio de 2027",
        dates: [
          "2026-11-24T17:00:00.000Z",
          "2026-12-01T17:00:00.000Z",
          "2026-12-08T17:00:00.000Z",
        ],
        series: {
          calendarId: "c-uni",
          title: "Inglés",
          description: null,
          location: null,
          startsAt: "2026-11-24T17:00:00.000Z",
          endsAt: "2026-11-24T18:00:00.000Z",
          allDay: false,
          rule: {
            freq: "weekly",
            interval: 1,
            byDay: ["TU"],
            end: { kind: "until", date: "2027-06-30" },
          },
        },
      }),
    ]);
    expect(mocks.createSingle).not.toHaveBeenCalled();
  });

  it("starts today when no day is said: weekdays at 7 (RF-5)", async () => {
    const { tools, actions } = setup();
    await tools.propose_series({
      series: [
        {
          title: "Gimnasio",
          calendar: "Uni",
          start: "07:00",
          freq: "daily",
          byDay: ["MO", "TU", "WE", "TH", "FR"],
        },
      ],
    });
    expect(actions[0]).toMatchObject({
      summary: "Cada semana de lunes a viernes",
      dates: [
        "2026-11-18T06:00:00.000Z",
        "2026-11-19T06:00:00.000Z",
        "2026-11-20T06:00:00.000Z",
      ],
    });
  });

  it("refuses a calendar of Google (RF-7)", async () => {
    const { tools, actions } = setup();
    expect(
      await tools.propose_series({
        series: [
          {
            title: "Inglés",
            calendar: "alexponmon@gmail.com",
            start: "18:00",
            freq: "weekly",
          },
        ],
      }),
    ).toEqual({
      status: "synced_calendar",
      notice:
        "No puedo crear eventos que se repiten en «alexponmon@gmail.com»: es un calendario traído de Google o iCloud. Puedo crearlos en: Uni.",
    });
    expect(actions).toEqual([]);
  });

  it("refuses a rule without any date (RF-5)", async () => {
    const { tools, actions } = setup();
    expect(
      await tools.propose_series({
        series: [
          {
            title: "Inglés",
            calendar: "Uni",
            date: "2026-11-24",
            start: "18:00",
            freq: "weekly",
            until: "2026-11-01",
          },
        ],
      }),
    ).toMatchObject({ status: "invalid_rule" });
    expect(actions).toEqual([]);
  });

  it("asks the hour when it is not said and the day is not all-day", async () => {
    const { tools } = setup();
    expect(
      await tools.propose_series({
        series: [{ title: "Inglés", calendar: "Uni", freq: "weekly" }],
      }),
    ).toEqual({ status: "need_time" });
  });
});
