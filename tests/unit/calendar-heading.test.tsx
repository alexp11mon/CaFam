import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarHeading } from "@/components/calendar/calendar-heading";
import { CalendarNavContext } from "@/components/calendar/calendar-nav";
import {
  CalendarHeaderProvider,
  usePublishCalendarHeader,
} from "@/components/shell/calendar-header";
import { CalendarSheet } from "@/components/shell/calendar-sheet";
import type { CalendarView } from "@/lib/calendar/ranges";

// Spec 030 (RF-7): the calendar's controls at the top of its content on a
// phone; they were a fixed bar in spec 026.
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
  render(
    <CalendarHeaderProvider>
      <CalendarNavContext value={go}>
        <Header onToday={onToday} />
        <CalendarHeading
          view={view}
          date="2026-11-15"
          today="2026-11-15"
          saveLastView={saveLastView}
        />
        <CalendarSheet />
      </CalendarNavContext>
    </CalendarHeaderProvider>,
  );
  const heading = screen.getByRole("navigation", { name: "Calendario" });
  return { go, onToday, saveLastView, heading };
}

describe("CalendarHeading", () => {
  it("is part of the content, only on a phone, and stays under the header", () => {
    const { heading } = setup();
    expect(heading).toHaveClass("tab:hidden", "sticky");
    expect(heading).not.toHaveClass("fixed");
  });

  it("offers the four views as pill tabs, the current one in the gradient, and remembers the choice", async () => {
    const { heading, go, saveLastView } = setup("month");
    const views = within(heading).getByRole("list", { name: "Vistas" });
    expect(
      within(views)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Agenda", "Día", "Semana", "Mes"]);
    const current = within(views).getByRole("link", { name: "Mes" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain(
      "aria-[current=page]:bg-accent-gradient",
    );

    await userEvent.click(within(views).getByRole("link", { name: "Semana" }));
    expect(go).toHaveBeenCalledExactlyOnceWith("week", "2026-11-15", [
      "cal-view",
    ]);
    expect(saveLastView).toHaveBeenCalledExactlyOnceWith("week");
  });

  it("moves to the previous and the next period in the browser", async () => {
    const { heading, go } = setup("week");
    await userEvent.click(
      within(heading).getByRole("button", { name: "Semana anterior" }),
    );
    await userEvent.click(
      within(heading).getByRole("button", { name: "Semana siguiente" }),
    );
    expect(go.mock.calls).toEqual([
      ["week", "2026-11-08", ["cal-prev"]],
      ["week", "2026-11-22", ["cal-next"]],
    ]);
  });

  it("goes to today, saying the date, and has no arrows in the agenda", async () => {
    const { heading, onToday } = setup("agenda");
    expect(
      within(heading).queryByRole("button", { name: /anterior/ }),
    ).toBeNull();
    await userEvent.click(
      await within(heading).findByRole("button", {
        name: "Hoy, domingo, 15 de noviembre de 2026",
      }),
    );
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("opens the sheet of calendars and takes the focus back when it closes", async () => {
    const { heading } = setup();
    const button = within(heading).getByRole("button", { name: "Calendarios" });
    await userEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Calendarios" });
    expect(sheet).toHaveAttribute("open");
    await userEvent.click(
      within(sheet).getByRole("button", { name: "Cerrar" }),
    );
    expect(button).toHaveFocus();
  });

  it("keeps every control 40 px or more to touch", () => {
    const { heading } = setup("week");
    for (const control of within(heading).getAllByRole("button")) {
      expect(control.className).toMatch(/\b(?:min-h-10|min-h-11|size-11)\b/);
    }
  });

  it("links to the search (spec 039 RF-1)", () => {
    const { heading } = setup();
    expect(
      within(heading).getByRole("link", { name: "Buscar" }),
    ).toHaveAttribute("href", "/dashboard/search");
  });
});

// Spec 042 T5: the year and the 4 days behind "Más vistas" (RF-10, plan D3).
describe("CalendarHeading with more views", () => {
  it("keeps four tabs and opens the others from Más vistas, remembering the choice", async () => {
    const { heading, go, saveLastView } = setup("month");
    const more = within(heading).getByRole("button", { name: "Más vistas" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more.className).toContain("min-h-10");
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(heading).getByRole("link", { name: "Año" }));
    expect(go).toHaveBeenCalledExactlyOnceWith("year", "2026-11-15", [
      "cal-view",
    ]);
    expect(saveLastView).toHaveBeenCalledExactlyOnceWith("year");
    expect(within(heading).queryByRole("link", { name: "Año" })).toBeNull();
  });

  it("closes with Escape", async () => {
    const { heading } = setup("month");
    await userEvent.click(
      within(heading).getByRole("button", { name: "Más vistas" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(
      within(heading).getByRole("button", { name: "Más vistas" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("names the chosen view on the button and moves by its period", async () => {
    const { heading, go } = setup("4days");
    const more = within(heading).getByRole("button", {
      name: "Más vistas: 4 días",
    });
    expect(more).toHaveAttribute("aria-current", "page");
    await userEvent.click(
      within(heading).getByRole("button", { name: "4 días siguientes" }),
    );
    expect(go).toHaveBeenCalledWith("4days", "2026-11-19", ["cal-next"]);
  });
});
