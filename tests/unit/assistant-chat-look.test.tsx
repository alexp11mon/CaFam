import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantChat } from "@/components/assistant/assistant-chat";

// Spec 027, T3: the chat as a conversation (RF-4, RF-5, RF-8).
const fetchMock = vi.fn();
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: Partial<Parameters<typeof AssistantChat>[0]> = {}) {
  const user = userEvent.setup();
  render(<AssistantChat timeZone="Europe/Madrid" {...props} />);
  const field = screen.getByLabelText("Tu pregunta");
  const chips = () =>
    within(screen.getByRole("list", { name: "Sugerencias" }))
      .getAllByRole("button")
      .map((chip) => chip.textContent);
  return { user, field, chips };
}

describe("the chat with Venito", () => {
  it("is headed by Venito, who is online", () => {
    setup();
    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("heading", { name: "Venito" }),
    ).toBeInTheDocument();
    expect(header).toHaveTextContent("en línea");
    expect(header.querySelector("[data-venito]")).not.toBeNull();
    // The full page has no "Cerrar"; the panel does.
    expect(screen.queryByRole("button", { name: "Cerrar el chat" })).toBeNull();
  });

  it("closes from its header when it lives in the panel", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });
    await user.click(screen.getByRole("button", { name: "Cerrar el chat" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows each message in its bubble with its hour, mine on the right in the accent", async () => {
    fetchMock.mockResolvedValue(
      json({ answer: "Hoy tienes dentista.", events: [], remaining: 29 }),
    );
    const { user, field } = setup();
    await user.type(field, "¿Qué hay hoy?{Enter}");

    const log = screen.getByRole("log");
    const answer = await within(log).findByText("Hoy tienes dentista.");
    const mine = within(log).getByText("¿Qué hay hoy?", { exact: false });
    expect(mine).toHaveClass("bg-accent", "text-on-accent");
    expect(mine.parentElement).toHaveClass("self-end");
    expect(answer.closest(".self-start")).not.toBeNull();
    // Venito signs its messages for screen readers and with its face.
    expect(within(log).getByText("Venito:")).toHaveClass("sr-only");
    expect(log.querySelectorAll("[data-venito]")).toHaveLength(1);
    const hours = [...log.querySelectorAll("time")].map((t) => t.textContent);
    expect(hours).toHaveLength(2);
    for (const hour of hours) expect(hour).toMatch(/^\d{2}:\d{2}$/);
  });

  it("says it is writing, with the dots, while it answers", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { user, field } = setup();
    await user.type(field, "¿Qué hay hoy?{Enter}");
    expect(screen.getByRole("banner")).toHaveTextContent("escribiendo…");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Pensando…");
    expect(status.querySelector("[data-typing]")).not.toBeNull();
    expect(status.querySelector('[data-venito="thinking"]')).not.toBeNull();
  });

  it("changes its suggestions after an answer (RF-5)", async () => {
    fetchMock.mockResolvedValue(
      json({ answer: "Nada.", events: [], remaining: 29 }),
    );
    const { user, chips } = setup();
    expect(chips()[0]).toBe("¿Qué tengo hoy?");

    // A whole question is sent with one tap (plan D4).
    await user.click(screen.getByRole("button", { name: "¿Qué tengo hoy?" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).messages).toEqual([
      { role: "user", content: "¿Qué tengo hoy?" },
    ]);
    await screen.findByText("Nada.");
    expect(chips()).toEqual([
      "¿Y mañana?",
      "¿Qué tardes tengo libres esta semana?",
      "Buscar un evento",
    ]);
  });

  it("writes what needs a name in the field instead of sending it", async () => {
    const { user, field } = setup();
    await user.click(screen.getByRole("button", { name: "Buscar un evento" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(field).toHaveValue("Busca el evento ");
    expect(field).toHaveFocus();
  });

  it("opens the image picker from its suggestion", async () => {
    const { user } = setup();
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click");
    await user.click(
      screen.getByRole("button", { name: "Crear eventos desde una foto" }),
    );
    expect(click).toHaveBeenCalledOnce();
  });

  it("keeps the field at 16 px and its controls 44 px to touch", () => {
    const { field } = setup();
    expect(field).toHaveClass("text-base", "min-h-11");
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveClass(
      "size-11",
      "bg-accent",
    );
    expect(screen.getByRole("button", { name: "Adjuntar imagen" })).toHaveClass(
      "size-11",
    );
  });

  it("tells whoever holds it when it is thinking and when it has answered", async () => {
    const onActivity = vi.fn();
    fetchMock.mockResolvedValue(
      json({ answer: "Nada.", events: [], remaining: 29 }),
    );
    const { user, field } = setup({ onActivity });
    await user.type(field, "¿Qué hay hoy?{Enter}");
    await screen.findByText("Nada.");
    expect(onActivity.mock.calls.map(([state]) => state)).toEqual([
      "thinking",
      "answered",
    ]);
  });
});
