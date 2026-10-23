import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ViewToolbar } from "@/components/calendar/view-toolbar";

const TODAY = "2026-10-21";

function href(name: string | RegExp) {
  return screen.getByRole("link", { name }).getAttribute("href");
}

describe("ViewToolbar (RF-29, RF-37)", () => {
  it("switches view keeping the reference date", () => {
    render(<ViewToolbar view="month" date="2026-10-14" today={TODAY} />);

    expect(href("Mes")).toBe("/dashboard/calendar?view=month&date=2026-10-14");
    expect(href("Semana")).toBe(
      "/dashboard/calendar?view=week&date=2026-10-14",
    );
    expect(href("Día")).toBe("/dashboard/calendar?view=day&date=2026-10-14");
  });

  it("marks the current view", () => {
    render(<ViewToolbar view="week" date="2026-10-14" today={TODAY} />);

    expect(screen.getByRole("link", { name: "Semana" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Mes" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("moves to the previous and next month", () => {
    render(<ViewToolbar view="month" date="2026-10-14" today={TODAY} />);

    expect(href("Mes anterior")).toBe(
      "/dashboard/calendar?view=month&date=2026-09-01",
    );
    expect(href("Mes siguiente")).toBe(
      "/dashboard/calendar?view=month&date=2026-11-01",
    );
  });

  it("moves by a week and by a day", () => {
    const { unmount } = render(
      <ViewToolbar view="week" date="2026-10-14" today={TODAY} />,
    );
    expect(href("Semana anterior")).toBe(
      "/dashboard/calendar?view=week&date=2026-10-07",
    );
    expect(href("Semana siguiente")).toBe(
      "/dashboard/calendar?view=week&date=2026-10-21",
    );
    unmount();

    render(<ViewToolbar view="day" date="2026-10-31" today={TODAY} />);
    expect(href("Día anterior")).toBe(
      "/dashboard/calendar?view=day&date=2026-10-30",
    );
    expect(href("Día siguiente")).toBe(
      "/dashboard/calendar?view=day&date=2026-11-01",
    );
  });

  it("offers the agenda and moves it 14 days at a time (spec 005 RF-30, RF-40, RF-41)", () => {
    render(<ViewToolbar view="agenda" date="2026-10-14" today={TODAY} />);

    expect(href("Agenda")).toBe(
      "/dashboard/calendar?view=agenda&date=2026-10-14",
    );
    expect(href("14 días anteriores")).toBe(
      "/dashboard/calendar?view=agenda&date=2026-09-30",
    );
    expect(href("14 días siguientes")).toBe(
      "/dashboard/calendar?view=agenda&date=2026-10-28",
    );
    expect(href("Hoy")).toBe("/dashboard/calendar?view=agenda&date=2026-10-21");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "14 oct – 27 oct 2026",
    );
  });

  it("goes back to today in the current view", () => {
    render(<ViewToolbar view="week" date="2027-01-05" today={TODAY} />);

    expect(href("Hoy")).toBe("/dashboard/calendar?view=week&date=2026-10-21");
  });

  it("names the period being shown", () => {
    const { unmount } = render(
      <ViewToolbar view="month" date="2026-10-14" today={TODAY} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "octubre de 2026",
    );
    unmount();

    const day = render(
      <ViewToolbar view="day" date="2026-10-21" today={TODAY} />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "miércoles, 21 de octubre de 2026",
    );
    day.unmount();

    render(<ViewToolbar view="week" date="2026-10-21" today={TODAY} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "19 oct – 25 oct 2026",
    );
  });

  it("saves the chosen view in the account (spec 008 RF-25)", async () => {
    const saveLastView = vi.fn(async () => ({}));
    render(
      <ViewToolbar
        view="agenda"
        date="2026-10-14"
        today={TODAY}
        saveLastView={saveLastView}
      />,
    );
    const month = screen.getByRole("link", { name: "Mes" });
    // jsdom cannot navigate: keep the click from trying.
    month.addEventListener("click", (event) => event.preventDefault());

    await userEvent.click(month);

    expect(saveLastView).toHaveBeenCalledWith("month");
  });

  it("shows the key of each view and of today (spec 008 RF-46)", () => {
    render(<ViewToolbar view="week" date="2026-10-14" today={TODAY} />);

    expect(screen.getByRole("link", { name: "Agenda" })).toHaveAttribute(
      "aria-keyshortcuts",
      "A",
    );
    expect(screen.getByRole("link", { name: "Mes" })).toHaveAttribute(
      "aria-keyshortcuts",
      "M",
    );
    expect(screen.getByRole("link", { name: "Semana" })).toHaveAttribute(
      "aria-keyshortcuts",
      "S",
    );
    expect(screen.getByRole("link", { name: "Día" })).toHaveAttribute(
      "aria-keyshortcuts",
      "D",
    );
    expect(screen.getByRole("link", { name: "Hoy" })).toHaveAttribute(
      "aria-keyshortcuts",
      "T",
    );
  });
});
