import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarDock } from "@/components/calendar/calendar-dock";
import { CalendarNavContext } from "@/components/calendar/calendar-nav";
import {
  CalendarHeaderProvider,
  usePublishCalendarHeader,
} from "@/components/shell/calendar-header";
import { CalendarSheet } from "@/components/shell/calendar-sheet";
import type { CalendarView } from "@/lib/calendar/ranges";

// Spec 026, T1: the calendar's own bar on a phone (RF-1..RF-4, RF-7).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

// Each test brings its own frame.
afterEach(() => {
  for (const frame of document.querySelectorAll("[data-app-frame]"))
    frame.remove();
});

function Header({ onToday }: { onToday: () => void }) {
  usePublishCalendarHeader({
    title: "noviembre",
    today: "2026-11-15",
    onToday,
    picker: "months",
  });
  return null;
}

function setup(view: CalendarView = "month") {
  const go = vi.fn();
  const onToday = vi.fn();
  const saveLastView = vi.fn(async () => ({}));
  const frame = document.createElement("div");
  frame.setAttribute("data-app-frame", "");
  document.body.append(frame);
  const result = render(
    <CalendarHeaderProvider>
      <CalendarNavContext value={go}>
        <Header onToday={onToday} />
        <CalendarDock
          view={view}
          date="2026-11-15"
          today="2026-11-15"
          saveLastView={saveLastView}
        />
        <CalendarSheet />
      </CalendarNavContext>
    </CalendarHeaderProvider>,
    { container: frame.appendChild(document.createElement("div")) },
  );
  const dock = screen.getByRole("navigation", { name: "Calendario" });
  return { go, onToday, saveLastView, frame, dock, ...result };
}

describe("CalendarDock", () => {
  it("sits right above the bottom bar, only on a phone (RF-1)", () => {
    const { dock } = setup();
    expect(dock.className).toContain(
      "bottom-[calc(4rem+env(safe-area-inset-bottom))]",
    );
    expect(dock).toHaveClass("tab:hidden", "fixed");
    for (const button of within(dock).getAllByRole("button")) {
      expect(button).toHaveClass("h-11");
    }
  });

  it("unfolds the four views with the current one marked and remembers the choice (RF-2)", async () => {
    const { dock, go, saveLastView } = setup("month");
    const trigger = within(dock).getByRole("button", { name: "Vista: Mes" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(dock.querySelector("ul")).toHaveAttribute("hidden");

    await userEvent.click(trigger);
    const views = screen.getByRole("list", { name: "Vistas" });
    expect(
      within(views)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Agenda", "Día", "Semana", "Mes"]);
    expect(within(views).getByRole("link", { name: "Mes" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await userEvent.click(within(views).getByRole("link", { name: "Semana" }));
    expect(go).toHaveBeenCalledExactlyOnceWith("week", "2026-11-15", [
      "cal-view",
    ]);
    expect(saveLastView).toHaveBeenCalledExactlyOnceWith("week");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the views with Escape, back on its button, and on a tap outside", async () => {
    const { dock } = setup();
    const trigger = within(dock).getByRole("button", { name: "Vista: Mes" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    await userEvent.click(trigger);
    await userEvent.pointer({ keys: "[MouseLeft>]", target: document.body });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("moves to the previous and the next period in the browser (RF-3)", async () => {
    const { dock, go } = setup("week");
    await userEvent.click(
      within(dock).getByRole("button", { name: "Semana anterior" }),
    );
    await userEvent.click(
      within(dock).getByRole("button", { name: "Semana siguiente" }),
    );
    expect(go.mock.calls).toEqual([
      ["week", "2026-11-08", ["cal-prev"]],
      ["week", "2026-11-22", ["cal-next"]],
    ]);
  });

  it("goes to today, saying the date, and has no arrows in the agenda (RF-3)", async () => {
    const { dock, onToday } = setup("agenda");
    expect(within(dock).queryByRole("button", { name: /anterior/ })).toBeNull();
    expect(
      within(dock).queryByRole("button", { name: /siguiente/ }),
    ).toBeNull();
    await userEvent.click(
      await within(dock).findByRole("button", {
        name: "Hoy, domingo, 15 de noviembre de 2026",
      }),
    );
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("opens the sheet of calendars and takes the focus back when it closes (RF-4)", async () => {
    const { dock } = setup();
    const button = within(dock).getByRole("button", { name: "Calendarios" });
    await userEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Calendarios" });
    expect(sheet).toHaveAttribute("open");

    await userEvent.click(
      within(sheet).getByRole("button", { name: "Cerrar" }),
    );
    expect(sheet).not.toHaveAttribute("open");
    expect(button).toHaveFocus();
  });

  it("tells the frame it is there, so the assistant and the toasts go above it (RF-7)", () => {
    const { frame, unmount } = setup();
    expect(frame).toHaveAttribute("data-has-dock");
    unmount();
    expect(frame).not.toHaveAttribute("data-has-dock");
    frame.remove();
  });
});
