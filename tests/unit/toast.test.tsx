import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/ui/toast";

// Spec 008, T4: a short notice after saving, deleting or duplicating (RF-32).
function Trigger({ text }: { text: string }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(text)}>
      Avisar
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast", () => {
  it("announces the message politely and hides it after 4 s", () => {
    render(
      <ToastProvider>
        <Trigger text="Evento creado" />
      </ToastProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    act(() => screen.getByRole("button", { name: "Avisar" }).click());
    expect(region).toHaveTextContent("Evento creado");

    act(() => vi.advanceTimersByTime(3999));
    expect(region).toHaveTextContent("Evento creado");
    act(() => vi.advanceTimersByTime(1));
    expect(region).toBeEmptyDOMElement();
  });

  it("replaces the message and restarts the countdown", () => {
    function Two() {
      const { show } = useToast();
      return (
        <>
          <button type="button" onClick={() => show("Evento creado")}>
            Uno
          </button>
          <button type="button" onClick={() => show("Evento borrado")}>
            Dos
          </button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Two />
      </ToastProvider>,
    );

    act(() => screen.getByRole("button", { name: "Uno" }).click());
    act(() => vi.advanceTimersByTime(3000));
    act(() => screen.getByRole("button", { name: "Dos" }).click());
    act(() => vi.advanceTimersByTime(3000));

    expect(screen.getByRole("status")).toHaveTextContent("Evento borrado");
  });

  it("does nothing outside a provider", () => {
    render(<Trigger text="Evento creado" />);

    expect(() =>
      act(() => screen.getByRole("button", { name: "Avisar" }).click()),
    ).not.toThrow();
  });
});
