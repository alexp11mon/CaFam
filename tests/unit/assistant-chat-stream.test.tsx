import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { encodeLine, type StreamLine } from "@/lib/assistant/stream";

// Spec 024, T8: progress while the assistant works (RF-16, RF-17, RF-19).
const fetchMock = vi.fn();

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

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

async function ask(text = "¿Y el dentista?") {
  const user = userEvent.setup();
  render(<AssistantChat timeZone="Europe/Madrid" />);
  await user.type(screen.getByLabelText("Tu pregunta"), `${text}{Enter}`);
  return user;
}

describe("AssistantChat with a streamed answer", () => {
  it("shows each step as the server tells it, then the answer (RF-17)", async () => {
    const answer = stream();
    fetchMock.mockResolvedValue(answer.response);
    await ask();

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Pensando…");
    await answer.send({ type: "status", text: "Buscando «dentista»…" });
    expect(status).toHaveTextContent("Buscando «dentista»…");
    await answer.send({ type: "status", text: "Escribiendo la respuesta…" });
    expect(status).toHaveTextContent("Escribiendo la respuesta…");

    await answer.send({
      type: "done",
      answer: "El sábado a las 10.",
      events: [],
      remaining: 29,
    });
    await answer.end();
    expect(
      await within(screen.getByRole("log")).findByText("El sábado a las 10."),
    ).toBeInTheDocument();
    expect(status).not.toHaveTextContent("Escribiendo");
  });

  it("gives the question back and offers to retry when it fails midway (RF-16)", async () => {
    const answer = stream();
    fetchMock.mockResolvedValue(answer.response);
    await ask("¿Qué hay hoy?");
    await answer.send({ type: "status", text: "Mirando tu calendario…" });
    await answer.send({
      type: "error",
      text: "El asistente no está disponible ahora mismo",
      retry: true,
    });
    await answer.end();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("no está disponible");
    expect(
      within(alert).getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tu pregunta")).toHaveValue("¿Qué hay hoy?");
  });

  it("offers to retry when the stream ends without an answer", async () => {
    const answer = stream();
    fetchMock.mockResolvedValue(answer.response);
    await ask();
    await answer.end();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no está disponible",
    );
  });

  it("is on screen before its context arrives and uses it afterwards (RF-19)", async () => {
    let arrive: (context: {
      timeZone: string;
      calendars: { id: string; name: string }[];
    }) => void = () => {};
    const loadContext = vi.fn(
      () =>
        new Promise<{
          timeZone: string;
          calendars: { id: string; name: string }[];
        }>((resolve) => (arrive = resolve)),
    );
    render(<AssistantChat loadContext={loadContext} />);
    expect(screen.getByLabelText("Tu pregunta")).toBeEnabled();
    expect(loadContext).toHaveBeenCalledOnce();
    await act(async () => arrive({ timeZone: "Europe/Madrid", calendars: [] }));
    expect(screen.getByLabelText("Tu pregunta")).toBeEnabled();
  });
});
