import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantAction } from "@/lib/assistant/actions";
import { encodeLine, type StreamLine } from "@/lib/assistant/stream";

// Spec 036, T7: Venito's cards in the conversation (RF-24a to RF-24c,
// RF-32, RF-38, RF-44, RF-45; plan D5, D10, D11, D12).

const { confirmChange, confirmDelete, undoAssistantAction } = vi.hoisted(
  () => ({
    confirmChange: vi.fn(),
    confirmDelete: vi.fn(),
    undoAssistantAction: vi.fn(),
  }),
);
vi.mock("@/app/dashboard/assistant/write-actions", () => ({
  confirmChange,
  confirmDelete,
  confirmSeries: vi.fn(),
  undoAssistantAction,
}));

const { AssistantChat } = await import("@/components/assistant/assistant-chat");

const fetchMock = vi.fn();
const ID = "11111111-1111-4111-8111-111111111111";
const event = {
  id: ID,
  title: "Comida Uni",
  startsAt: "2026-11-19T12:30:00.000Z",
  endsAt: "2026-11-19T13:30:00.000Z",
  allDay: false,
  calendarName: "Uni",
  color: "#A0C4FF",
};
const created: AssistantAction = {
  kind: "created",
  key: "a1",
  event,
  undo: { kind: "uncreate", id: ID, updatedAt: "u1" },
};
const change = (key: string, hour: string): AssistantAction => ({
  kind: "change",
  key,
  before: event,
  after: {
    ...event,
    startsAt: `2026-11-19T${hour}:00:00.000Z`,
    endsAt: `2026-11-19T${hour}:59:00.000Z`,
  },
  scope: null,
  change: {
    id: ID,
    scope: null,
    updatedAt: "u1",
    fields: {
      title: "Comida Uni",
      description: null,
      location: null,
      calendarId: "22222222-2222-4222-8222-222222222222",
      startsAt: `2026-11-19T${hour}:00:00.000Z`,
      endsAt: `2026-11-19T${hour}:59:00.000Z`,
      allDay: false,
    },
  },
});

/** A streamed answer the test feeds line by line. */
function stream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start: (c) => void (controller = c),
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(body, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
    }),
    send: (line: StreamLine) =>
      act(async () => controller.enqueue(encoder.encode(encodeLine(line)))),
    end: () => act(async () => controller.close()),
  };
}

/** A whole answer at once. */
function answer(text: string, actions: AssistantAction[] = []) {
  return new Response(
    [
      ...actions.map((action) => encodeLine({ type: "action", action })),
      encodeLine({
        type: "done",
        answer: text,
        events: [],
        ...(actions.length ? { actions } : {}),
        remaining: 20,
      }),
    ].join(""),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
}

const sentThread = (call: number) =>
  JSON.parse(fetchMock.mock.calls[call]![1].body).messages as {
    role: string;
    content: string;
  }[];

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const onChanged = vi.fn();
  const user = userEvent.setup();
  render(<AssistantChat timeZone="Europe/Madrid" onChanged={onChanged} />);
  const say = (text: string) =>
    user.type(screen.getByLabelText("Tu pregunta"), `${text}{Enter}`);
  return { user, say, onChanged };
}

describe("AssistantChat with Venito's cards", () => {
  it("shows a created event and refreshes the calendar (RF-32, RF-38)", async () => {
    fetchMock.mockResolvedValue(answer("He creado Comida Uni.", [created]));
    const { say, onChanged } = setup();
    await say("Crea Comida Uni cuando acabe PIAE");
    const log = screen.getByRole("log");
    expect(
      await within(log).findByRole("region", { name: /Evento creado/ }),
    ).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("tells Venito what its cards say in the next question (plan D10, RF-45)", async () => {
    fetchMock
      .mockResolvedValueOnce(answer("He creado Comida Uni.", [created]))
      .mockResolvedValueOnce(answer("Hecho."));
    const { say } = setup();
    await say("Crea Comida Uni cuando acabe PIAE");
    await screen.findByRole("region", { name: /Evento creado/ });
    await say("Muévelo a mañana");
    await screen.findByText("Hecho.");
    expect(sentThread(1)[1]).toEqual({
      role: "assistant",
      content:
        "He creado Comida Uni.\n[Evento creado: Comida Uni, jueves 19 de noviembre, de 13:30 a 14:30, en Uni]",
    });
  });

  it("confirms a pending change with «sí», without asking Venito (RF-24a, D5)", async () => {
    confirmChange.mockResolvedValue({ ok: true });
    fetchMock.mockResolvedValue(
      answer("Revisa el cambio y pulsa Confirmar.", [change("c1", "14")]),
    );
    const { say, onChanged } = setup();
    await say("Cambia Comida Uni a las 15:00");
    await screen.findByText("Cambio pendiente");
    expect(onChanged).not.toHaveBeenCalled();

    await say("sí");
    expect(await screen.findByText("Cambio aplicado")).toBeInTheDocument();
    expect(confirmChange).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Hecho: he aplicado el cambio."),
    ).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  // Spec 052 RF-2: "sí" and "no" answer a deletion as they do a change.
  it("deletes a pending deletion with «sí», without asking Venito", async () => {
    confirmDelete.mockResolvedValue({ ok: true });
    fetchMock.mockResolvedValue(
      answer("Revisa y pulsa Borrar.", [
        {
          kind: "delete",
          key: "d1",
          event,
          scope: null,
          remove: { id: ID, scope: null, updatedAt: "u1" },
        },
      ]),
    );
    const { say, onChanged } = setup();
    await say("Borra Comida Uni");
    await screen.findByText("Borrado pendiente");
    await say("sí");
    expect(await screen.findByText("Evento borrado")).toBeInTheDocument();
    expect(confirmDelete).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Hecho: lo he borrado.")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending change with «no» (RF-24b)", async () => {
    fetchMock.mockResolvedValue(
      answer("Revisa el cambio.", [change("c1", "14")]),
    );
    const { say } = setup();
    await say("Cambia Comida Uni a las 15:00");
    await screen.findByText("Cambio pendiente");
    await say("no");
    expect(await screen.findByText("Cancelado")).toBeInTheDocument();
    expect(screen.getByText("Vale, no lo cambio.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(confirmChange).not.toHaveBeenCalled();
  });

  it("replaces a pending change with a corrected one (RF-24c)", async () => {
    fetchMock
      .mockResolvedValueOnce(answer("Revisa.", [change("c1", "14")]))
      .mockResolvedValueOnce(answer("Revisa este.", [change("c2", "17")]));
    const { say } = setup();
    await say("Cambia Comida Uni a las 15:00");
    await screen.findByText("Cambio pendiente");
    await say("mejor a las 18:00");
    await screen.findByText("Revisa este.");
    expect(screen.getByText("Sustituido")).toBeInTheDocument();
    expect(screen.getAllByText("Cambio pendiente")).toHaveLength(1);
  });

  it("cancels a pending change when the user asks something else (RF-24b)", async () => {
    fetchMock
      .mockResolvedValueOnce(answer("Revisa.", [change("c1", "14")]))
      .mockResolvedValueOnce(answer("Mañana tienes cine."));
    const { say } = setup();
    await say("Cambia Comida Uni a las 15:00");
    await screen.findByText("Cambio pendiente");
    await say("¿Qué tengo mañana?");
    await screen.findByText("Mañana tienes cine.");
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });

  it("keeps what was already created when the user cancels (RF-44, D12)", async () => {
    const live = stream();
    fetchMock.mockResolvedValue(live.response);
    const { say, user, onChanged } = setup();
    await say("Crea Comida Uni y Cena");
    await live.send({ type: "action", action: created });
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await live.end();

    expect(
      await screen.findByText("He parado. Esto ya estaba hecho:"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Evento creado/ }),
    ).toBeInTheDocument();
    // The question stays in the thread: it was partly done.
    expect(screen.getByLabelText("Tu pregunta")).toHaveValue("");
    expect(onChanged).toHaveBeenCalled();
  });
});
