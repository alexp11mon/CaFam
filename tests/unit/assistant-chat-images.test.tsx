import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 022, T8: attaching images to the assistant (RF-1 to RF-3, RF-10 to
// RF-12, RF-54 to RF-56, RF-58; plan D2, D9).
const prepare = vi.hoisted(() => vi.fn());
vi.mock("@/lib/images/prepare-image", () => ({ prepareForAssistant: prepare }));

const { AssistantChat } = await import("@/components/assistant/assistant-chat");

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const png = (name = "horario.png") =>
  new File(["x"], name, { type: "image/png" });

const PROPOSAL = {
  id: "p1",
  omitted: 0,
  rows: [
    {
      key: "r1",
      title: "Turno",
      startDate: "2026-11-16",
      start: "08:00",
      endDate: "2026-11-16",
      end: "15:00",
      allDay: false,
      calendarId: "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11",
      selected: true,
      duplicate: false,
    },
  ],
};

function setup() {
  const user = userEvent.setup();
  render(<AssistantChat timeZone="Europe/Madrid" calendars={[]} />);
  const input = () =>
    document.querySelector<HTMLInputElement>('input[type="file"]')!;
  const field = () => screen.getByLabelText("Tu pregunta");
  return { user, input, field };
}

const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call]![1].body);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  prepare.mockReset();
  let n = 0;
  prepare.mockImplementation(async () => ({
    dataUrl: `data:image/jpeg;base64,AA${++n}`,
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("attaching images", () => {
  it("offers the camera or the gallery and says where images go (RF-1, RF-2, RF-58)", () => {
    const { input } = setup();
    expect(
      screen.getByRole("button", { name: "Adjuntar imagen" }),
    ).toBeInTheDocument();
    expect(input()).toHaveAttribute("accept", "image/*");
    expect(input()).toHaveAttribute("multiple");
    expect(input()).not.toHaveAttribute("capture");
    const note = screen.getByText(/se envían a Groq para leerlas/);
    expect(within(note).getByRole("link")).toHaveAttribute("href", "/privacy");
  });

  it("shows each image with «Quitar imagen» and removes it (RF-10)", async () => {
    const { user, input } = setup();
    await user.upload(input(), [png("a.png"), png("b.png")]);
    const list = await screen.findByRole("list", {
      name: "Imágenes para enviar",
    });
    expect(within(list).getAllByRole("img")).toHaveLength(2);
    await user.click(
      within(list).getAllByRole("button", { name: /Quitar imagen/ })[0]!,
    );
    expect(within(list).getAllByRole("img")).toHaveLength(1);
  });

  it("refuses a fourth image and says why a file fails (RF-5, RF-7)", async () => {
    const { user, input } = setup();
    await user.upload(input(), [png("1.png"), png("2.png"), png("3.png")]);
    await screen.findAllByRole("button", { name: /Quitar imagen/ });
    await user.upload(input(), [png("4.png")]);
    expect(
      await screen.findByText("Puedes adjuntar 3 imágenes como mucho"),
    ).toBeInTheDocument();
    prepare.mockResolvedValueOnce({
      error: "Este navegador no puede leer esta imagen.",
    });
    await user.click(
      screen.getAllByRole("button", { name: /Quitar imagen/ })[0]!,
    );
    await user.upload(input(), [png("rara.png")]);
    expect(
      await screen.findByText(
        "rara.png: Este navegador no puede leer esta imagen.",
      ),
    ).toBeInTheDocument();
  });

  it("attaches an image pasted in the question (RF-3)", async () => {
    const { field } = setup();
    fireEvent.paste(field(), { clipboardData: { files: [png()] } });
    expect(
      await screen.findByRole("button", { name: /Quitar imagen/ }),
    ).toBeInTheDocument();
  });

  it("sends images without text and shows them in the message (RF-11, RF-12)", async () => {
    fetchMock.mockResolvedValue(
      json({
        answer: "He leído 1 evento.",
        events: [],
        proposal: PROPOSAL,
        remaining: 29,
      }),
    );
    const { user, input } = setup();
    await user.upload(input(), [png()]);
    await screen.findByRole("button", { name: /Quitar imagen/ });
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(sentBody().messages).toEqual([
      { role: "user", content: "", images: ["data:image/jpeg;base64,AA1"] },
    ]);
    const log = screen.getByRole("log");
    expect(
      await within(log).findByText("He leído 1 evento."),
    ).toBeInTheDocument();
    expect(
      within(log).getByRole("img", { name: "Imagen adjunta 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Imágenes para enviar" }),
    ).not.toBeInTheDocument();
  });

  it("gives back text and images on cancel and on failure (RF-54, RF-55)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: "El asistente no está disponible ahora mismo" }, 503),
    );
    const { user, input, field } = setup();
    await user.upload(input(), [png()]);
    await screen.findByRole("button", { name: /Quitar imagen/ });
    await user.type(field(), "Soy Ana{Enter}");
    expect(
      await screen.findByText("El asistente no está disponible ahora mismo"),
    ).toBeInTheDocument();
    expect(field()).toHaveValue("Soy Ana");
    expect(
      screen.getByRole("button", { name: /Quitar imagen/ }),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      json({ answer: "Ok.", events: [], remaining: 29 }),
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(sentBody(1).messages[0].images).toHaveLength(1);
  });

  it("sends the images again with the answer to the assistant's question (D2)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({ answer: "¿De qué semana es?", events: [], remaining: 29 }),
      )
      .mockResolvedValueOnce(
        json({
          answer: "He leído 1 evento.",
          events: [],
          proposal: PROPOSAL,
          remaining: 28,
        }),
      )
      .mockResolvedValueOnce(
        json({
          answer: "Hecho.",
          events: [],
          proposal: PROPOSAL,
          remaining: 27,
        }),
      );
    const { user, input, field } = setup();
    await user.upload(input(), [png()]);
    await screen.findByRole("button", { name: /Quitar imagen/ });
    await user.type(field(), "Soy Ana{Enter}");
    await screen.findByText("¿De qué semana es?");
    await user.type(field(), "La que viene{Enter}");
    await screen.findByText("He leído 1 evento.");
    const second = sentBody(1).messages;
    expect(second[0]).toEqual({ role: "user", content: "Soy Ana" });
    expect(second.at(-1)).toEqual({
      role: "user",
      content: "La que viene",
      images: ["data:image/jpeg;base64,AA1"],
    });
    // With a proposal, corrections go without images and with the rows (RF-33).
    await user.type(field(), "El martes a las 9{Enter}");
    await screen.findByText("Hecho.");
    const third = sentBody(2);
    expect(third.messages.at(-1)).toEqual({
      role: "user",
      content: "El martes a las 9",
    });
    expect(third.proposal).toEqual(PROPOSAL.rows);
  });

  it("drops the pending proposal with Nueva conversación (RF-56)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          answer: "He leído 1 evento.",
          events: [],
          proposal: PROPOSAL,
          remaining: 29,
        }),
      )
      .mockResolvedValueOnce(
        json({ answer: "Nada.", events: [], remaining: 28 }),
      );
    const { user, input, field } = setup();
    await user.upload(input(), [png()]);
    await screen.findByRole("button", { name: /Quitar imagen/ });
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByText("He leído 1 evento.");
    await user.click(
      screen.getByRole("button", { name: "Nueva conversación" }),
    );
    await user.type(field(), "¿Qué hay hoy?{Enter}");
    await screen.findByText("Nada.");
    expect(sentBody(1)).toEqual({
      messages: [{ role: "user", content: "¿Qué hay hoy?" }],
    });
  });
});
