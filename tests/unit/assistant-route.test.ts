// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantUnavailable } from "@/lib/assistant/provider";

// Spec 015, T8: POST /api/assistant (plan assistant-route, D3, D9; RF-3,
// RF-4, RF-27, RF-28).
const {
  getClaims,
  gte,
  insert,
  runAssistant,
  runProposal,
  runTool,
  getMyCalendars,
  getEventsInRange,
} = vi.hoisted(() => ({
  getClaims: vi.fn(),
  gte: vi.fn(),
  insert: vi.fn(),
  runAssistant: vi.fn(),
  runProposal: vi.fn(),
  runTool: vi.fn(),
  getMyCalendars: vi.fn(),
  getEventsInRange: vi.fn(),
}));

const supabase = {
  auth: { getClaims },
  from: (table: string) => {
    if (table !== "assistant_questions") throw new Error(table);
    return { select: () => ({ gte }), insert };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
}));
vi.mock("@/lib/calendar/queries", () => ({
  getProfileTimeZone: async () => "Europe/Madrid",
  getMyCalendars,
  getEventsInRange,
}));
vi.mock("@/lib/assistant/run", () => ({ runAssistant, runProposal }));
vi.mock("@/lib/assistant/tools", () => ({ runTool }));

import { POST, maxDuration } from "@/app/api/assistant/route";

const QUESTION = { messages: [{ role: "user", content: "¿Qué hay hoy?" }] };

function post(body: unknown, signal?: AbortSignal) {
  return POST(
    new Request("https://cafam.test/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  gte.mockResolvedValue({ count: 3, error: null });
  insert.mockResolvedValue({ error: null });
  runAssistant.mockResolvedValue({ answer: "Nada hoy.", events: [] });
});

describe("POST /api/assistant", () => {
  it("answers 401 without a session", async () => {
    getClaims.mockResolvedValue({ data: null });
    const response = await post(QUESTION);
    expect(response.status).toBe(401);
    expect(runAssistant).not.toHaveBeenCalled();
  });

  it("answers 400 with the message for an invalid question (RF-3)", async () => {
    const response = await post({ messages: [{ role: "user", content: " " }] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Escribe una pregunta." });
    expect((await post("nope")).status).toBe(400);
  });

  it("refuses the 31st question of the day without calling the model (RF-27)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
    gte.mockResolvedValue({ count: 30, error: null });
    const response = await post(QUESTION);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("30 preguntas");
    // Counted from 00:00 in the profile's zone.
    expect(gte).toHaveBeenCalledWith("asked_at", "2026-11-01T23:00:00.000Z");
    expect(runAssistant).not.toHaveBeenCalled();
  });

  it("answers, records the question and tells what is left", async () => {
    const events = [{ id: "e", title: "Cine" }];
    runAssistant.mockResolvedValue({ answer: "Cine [visto].", events });
    const response = await post(QUESTION);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      answer: "Cine [visto].",
      events,
      remaining: 26,
    });
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1" });
    expect(runAssistant.mock.calls[0]![0]).toEqual(QUESTION.messages);
  });

  it("binds the tools to the session user (RF-29)", async () => {
    await post(QUESTION);
    const deps = runAssistant.mock.calls[0]![1];
    expect(deps.timeZone).toBe("Europe/Madrid");
    await deps.runTool("list_events", "{}", "refs");
    expect(runTool).toHaveBeenCalledWith("list_events", "{}", {
      supabase,
      userId: "user-1",
      timeZone: "Europe/Madrid",
      now: deps.now,
      refs: "refs",
      excludeSynced: false,
    });
  });

  it("answers 503 and does not record when the provider fails (RF-28)", async () => {
    runAssistant.mockRejectedValue(new AssistantUnavailable("status 500"));
    const response = await post(QUESTION);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "El asistente no está disponible ahora mismo",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("passes the request's signal and records nothing when it is cancelled (RF-4)", async () => {
    const controller = new AbortController();
    runAssistant.mockImplementation(async (_m, _d, signal: AbortSignal) => {
      controller.abort();
      signal.throwIfAborted();
    });
    const response = await post(QUESTION, controller.signal);
    expect(runAssistant.mock.calls[0]![2]).toBeInstanceOf(AbortSignal);
    expect(response.status).toBe(499);
    expect(insert).not.toHaveBeenCalled();
  });
});

// Spec 022, T6: images and proposals (RF-13, RF-14, RF-33, RF-53, RF-54; D6).
describe("POST /api/assistant with images", () => {
  const IMG = "data:image/jpeg;base64,/9j/4AAQ";
  const WITH_IMAGES = {
    messages: [{ role: "user", content: "Soy Ana", images: [IMG] }],
  };
  const PROPOSAL = { id: "p1", rows: [], omitted: 0 };

  beforeEach(() => {
    runProposal.mockResolvedValue({
      answer: "He leído 1 evento.",
      events: [],
      proposal: PROPOSAL,
    });
    getMyCalendars.mockResolvedValue([
      { id: "c1", name: "Trabajo", role: "editor", synced: null },
      { id: "c2", name: "Cole", role: "viewer", synced: null },
      {
        id: "c3",
        name: "Google",
        role: "owner",
        synced: { canWrite: false },
      },
    ]);
    getEventsInRange.mockResolvedValue([
      {
        id: "e1",
        calendarId: "c1",
        startsAt: "2026-11-16T07:00:00Z",
        endsAt: "2026-11-16T14:00:00Z",
        title: "Turno",
      },
    ]);
  });

  it("allows 45 s for reading images (D6)", () => {
    expect(maxDuration).toBe(45);
  });

  it("answers a message with images with a proposal and counts it (RF-14, RF-53)", async () => {
    const response = await post(WITH_IMAGES);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      answer: "He leído 1 evento.",
      events: [],
      proposal: PROPOSAL,
      remaining: 26,
    });
    expect(runAssistant).not.toHaveBeenCalled();
    expect(runProposal.mock.calls[0]![0]).toEqual(WITH_IMAGES.messages);
    expect(runProposal.mock.calls[0]![1]).toBeUndefined();
    expect(insert).toHaveBeenCalledWith({ user_id: "user-1" });
  });

  it("gives the proposal only the calendars the user can write to (RF-26)", async () => {
    await post(WITH_IMAGES);
    const deps = runProposal.mock.calls[0]![2];
    expect(deps.proposal.calendars).toEqual([
      { id: "c1", name: "Trabajo", canWrite: true },
      { id: "c2", name: "Cole", canWrite: false },
      { id: "c3", name: "Google", canWrite: false },
    ]);
    expect(await deps.proposal.loadEvents(new Date(), new Date())).toEqual([
      {
        calendarId: "c1",
        startsAt: "2026-11-16T07:00:00Z",
        endsAt: "2026-11-16T14:00:00Z",
      },
    ]);
  });

  it("sends a correction with the current proposal to runProposal (RF-33)", async () => {
    const row = {
      key: "r1",
      title: "Turno",
      startDate: "2026-11-17",
      start: "08:00",
      endDate: "2026-11-17",
      end: "15:00",
      allDay: false,
      calendarId: "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11",
      selected: true,
      duplicate: false,
    };
    await post({
      messages: [{ role: "user", content: "El martes a las 9" }],
      proposal: [row],
    });
    expect(runAssistant).not.toHaveBeenCalled();
    expect(runProposal.mock.calls[0]![1]).toEqual([row]);
  });

  it("answers 503 without logging the images when the provider fails (RF-54, R8)", async () => {
    const spies = (["log", "warn", "error", "info"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    runProposal.mockRejectedValue(new AssistantUnavailable("status 429"));
    const response = await post(WITH_IMAGES);
    expect(response.status).toBe(503);
    expect(insert).not.toHaveBeenCalled();
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain("base64");
      }
      spy.mockRestore();
    }
  });
});
