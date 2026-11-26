import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIC_NOTE, MicButton } from "@/components/assistant/mic-button";
import { fakeRecognition } from "./speech-fakes";

// Spec 052 T6: the microphone of the chat (RF-13, RF-15, RNF-2).

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const fake = fakeRecognition();
  vi.stubGlobal("webkitSpeechRecognition", fake.Ctor);
  const onText = vi.fn();
  const onError = vi.fn();
  const onListening = vi.fn();
  render(
    <MicButton onText={onText} onError={onError} onListening={onListening} />,
  );
  return { ...fake, onText, onError, onListening, user: userEvent.setup() };
}

describe("MicButton", () => {
  it("is not there without speech recognition (RF-15)", () => {
    render(<MicButton onText={vi.fn()} onError={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Dictar" })).toBeNull();
  });

  it("says where the voice may go the first time, then listens (RF-15)", async () => {
    const { user, made, onListening } = setup();
    await user.click(screen.getByRole("button", { name: "Dictar" }));
    expect(screen.getByText(MIC_NOTE)).toBeInTheDocument();
    expect(made).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Entendido" }));
    expect(made).toHaveLength(1);
    expect(onListening).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole("button", { name: "Dejar de dictar" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Escuchando…");
  });

  it("puts what is heard in the field and stops on a second tap (RF-13)", async () => {
    localStorage.setItem("cafam-mic-note", "1");
    const { user, made, onText, onListening } = setup();
    await user.click(screen.getByRole("button", { name: "Dictar" }));
    act(() => made[0]!.hear("crea cena el viernes"));
    expect(onText).toHaveBeenLastCalledWith("crea cena el viernes");
    await user.click(screen.getByRole("button", { name: "Dejar de dictar" }));
    expect(made[0]!.stop).toHaveBeenCalled();
    expect(onListening).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Dictar" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("explains a denied microphone", async () => {
    localStorage.setItem("cafam-mic-note", "1");
    const { user, made, onError } = setup();
    await user.click(screen.getByRole("button", { name: "Dictar" }));
    act(() => made[0]!.onerror!({ error: "not-allowed" }));
    expect(onError).toHaveBeenLastCalledWith(
      "No hay permiso para usar el micrófono. Puedes darlo en los ajustes del navegador.",
    );
  });

  it("works with the keyboard", async () => {
    localStorage.setItem("cafam-mic-note", "1");
    const { user, made } = setup();
    screen.getByRole("button", { name: "Dictar" }).focus();
    await user.keyboard("{Enter}");
    expect(made).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(made[0]!.stop).toHaveBeenCalled();
  });
});
