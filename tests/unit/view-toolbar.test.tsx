import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
