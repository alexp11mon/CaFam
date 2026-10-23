import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity, useState } from "react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EventModal } from "@/components/calendar/event-modal";

// Spec 008, T1: the event window over the calendar (RF-4, RF-5, RF-6, RF-12, RF-29).
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  router.back.mockClear();
});

function renderModal() {
  const opener = document.createElement("button");
  opener.textContent = "Cena familiar";
  document.body.append(opener);
  opener.focus();
  const view = render(
    <EventModal title="Cena familiar">
      <p>Contenido</p>
    </EventModal>,
  );
  return { opener, ...view };
}

describe("EventModal", () => {
  it("opens as a modal dialog named by its title (RF-4, RF-12)", () => {
    renderModal();

    const dialog = screen.getByRole("dialog", { name: "Cena familiar" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Contenido")).toBeVisible();
  });

  it("goes back when 'Cerrar' is pressed (RF-6)", async () => {
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("goes back on Escape instead of letting the dialog close itself (RF-6)", () => {
    renderModal();

    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("gives the focus back to what opened it when it goes away (RF-6)", () => {
    const { opener, unmount } = renderModal();
    screen.getByRole("button", { name: "Cerrar" }).focus();
    expect(opener).not.toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("switches between window and full screen (RF-5)", async () => {
    renderModal();
    const toggle = screen.getByRole("button", { name: "Pantalla completa" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-fullscreen",
      "true",
    );
  });

  it("is always full screen on a phone, without the toggle (RF-29)", () => {
    renderModal();

    // Up to 768 px the CSS forces full screen and hides the toggle.
    expect(screen.getByRole("dialog").className).toMatch(
      /max-\[48\.0625rem\]:h-full/,
    );
    expect(
      screen.getByRole("button", { name: "Pantalla completa" }).className,
    ).toMatch(/max-\[48\.0625rem\]:hidden/);
  });

  it("starts its content afresh each time Next shows the kept route again", async () => {
    function Counter() {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount((n) => n + 1)}>
          Pulsado {count}
        </button>
      );
    }
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <EventModal title="Cena familiar">
          <Counter />
        </EventModal>
      </Activity>
    );
    const { rerender } = render(tree("visible"));
    await userEvent.click(screen.getByRole("button", { name: "Pulsado 0" }));
    expect(screen.getByRole("button", { name: "Pulsado 1" })).toBeVisible();

    act(() => rerender(tree("hidden")));
    act(() => rerender(tree("visible")));

    expect(screen.getByRole("button", { name: "Pulsado 0" })).toBeVisible();
  });
});
