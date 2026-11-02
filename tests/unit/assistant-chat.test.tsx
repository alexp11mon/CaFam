import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantChat } from "@/components/assistant/assistant-chat";

// Spec 015, T9: the assistant screen (RF-1 to RF-6, RF-11, RF-27, RF-28,
// RF-33; plan assistant-ui, R6).
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EVENT = {
  id: "5b8f6c2e-3f0a-4d8e-9a51-2a8f1d7c9e10_20261107T090000Z",
  title: "Fútbol de Pablo",
  startsAt: "2026-11-07T09:00:00Z",
  endsAt: "2026-11-07T10:30:00Z",
  allDay: false,
  calendarName: "Familia",
  color: "#A0C4FF",
};

function setup() {
  const user = userEvent.setup();
  const view = render(<AssistantChat timeZone="Europe/Madrid" />);
  const field = () => screen.getByLabelText("Tu pregunta");
  return { user, field, ...view };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("AssistantChat", () => {
  it("starts with the privacy notice and three examples (RF-2, RF-33)", () => {
    setup();
    expect(screen.getByText(/se envían a Groq/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "política de privacidad" }),
    ).toHaveAttribute("href", "/privacy");
    const examples = within(
      screen.getByRole("list", { name: "Ejemplos de preguntas" }),
    ).getAllByRole("button");
    expect(examples).toHaveLength(3);
  });

  it("sends an example when pressed and shows the answer with its events (RF-2, RF-3, RF-11)", async () => {
    fetchMock.mockResolvedValue(
      json({
        answer: "El sábado tienes fútbol.",
        events: [EVENT],
        remaining: 29,
      }),
    );
    const { user, field } = setup();
    const [first] = within(
      screen.getByRole("list", { name: "Ejemplos de preguntas" }),
    ).getAllByRole("button");
    await user.click(first!);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/assistant");
    expect(JSON.parse(init.body)).toEqual({
      messages: [{ role: "user", content: first!.textContent }],
    });
    const log = screen.getByRole("log");
    expect(
      await within(log).findByText("El sábado tienes fútbol."),
    ).toBeInTheDocument();
    const link = within(log).getByRole("link", { name: /Fútbol de Pablo/ });
    expect(link).toHaveAttribute("href", `/dashboard/events/${EVENT.id}`);
    expect(link).toHaveTextContent("Familia");
    expect(field()).toHaveFocus();
    expect(screen.queryByText(/se envían a Groq/)).not.toBeInTheDocument();
  });

  it("validates the question (RF-3) and sends with Enter, new line with Shift+Enter", async () => {
    fetchMock.mockResolvedValue(
      json({ answer: "Nada.", events: [], remaining: 29 }),
    );
    const { user, field } = setup();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(
      await screen.findByText("Escribe una pregunta."),
    ).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(field());
    await user.paste("a".repeat(501));
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(
      await screen.findByText(
        "La pregunta puede tener como mucho 500 caracteres.",
      ),
    ).toBeInTheDocument();

    await user.clear(field());
    await user.type(field(), "Hola{Shift>}{Enter}{/Shift}qué tal");
    expect(field()).toHaveValue("Hola\nqué tal");
    await user.type(field(), "{Enter}");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("thinks with a Cancel button that aborts and keeps the question (RF-4)", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          signal = init.signal!;
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const { user, field } = setup();
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("Pensando…");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(signal?.aborted).toBe(true);
    expect(await screen.findByLabelText("Tu pregunta")).toHaveValue(
      "¿Qué hay hoy?",
    );
    expect(screen.queryByText("Pensando…")).not.toBeInTheDocument();
  });

  it("sends the whole thread and starts over with Nueva conversación (RF-5, RF-6)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ answer: "Fútbol.", events: [], remaining: 29 }),
      )
      .mockResolvedValueOnce(
        json({ answer: "Comida.", events: [], remaining: 28 }),
      );
    const { user, field } = setup();
    await user.type(field(), "¿Qué hay el sábado?{Enter}");
    await screen.findByText("Fútbol.");
    await user.type(field(), "¿Y el domingo?{Enter}");
    await screen.findByText("Comida.");
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).messages).toEqual([
      { role: "user", content: "¿Qué hay el sábado?" },
      { role: "assistant", content: "Fútbol." },
      { role: "user", content: "¿Y el domingo?" },
    ]);

    await user.click(
      screen.getByRole("button", { name: "Nueva conversación" }),
    );
    expect(screen.queryByText("Fútbol.")).not.toBeInTheDocument();
    expect(screen.getByText(/se envían a Groq/)).toBeInTheDocument();
  });

  it("offers to retry when the assistant is unavailable (RF-28)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ error: "El asistente no está disponible ahora mismo" }, 503),
      )
      .mockResolvedValueOnce(
        json({ answer: "Ya está.", events: [], remaining: 29 }),
      );
    const { user, field } = setup();
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    expect(
      await screen.findByText("El asistente no está disponible ahora mismo"),
    ).toBeInTheDocument();
    expect(field()).toHaveValue("¿Qué hay hoy?");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Ya está.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).messages).toEqual([
      { role: "user", content: "¿Qué hay hoy?" },
    ]);
  });

  it("explains a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { user, field } = setup();
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    expect(await screen.findByText(/No hay conexión/)).toBeInTheDocument();
  });

  it("stops sending after the daily quota (RF-27)", async () => {
    fetchMock.mockResolvedValue(
      json(
        { error: "Has hecho las 30 preguntas de hoy. Podrás seguir mañana." },
        429,
      ),
    );
    const { user, field } = setup();
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    expect(await screen.findByText(/30 preguntas de hoy/)).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("aborts a pending question when it unmounts (R6)", async () => {
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signal = init.signal!;
      return new Promise(() => {});
    });
    const { user, field, unmount } = setup();
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    act(() => unmount());
    expect(signal?.aborted).toBe(true);
  });
});
