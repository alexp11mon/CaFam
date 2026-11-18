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
