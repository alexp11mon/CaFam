import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MonthView } from "@/components/calendar/month-view";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { getVisibleRange } from "@/lib/calendar/ranges";

const TZ = "Europe/Madrid";
const TODAY = "2026-10-21";
const DAYS = getVisibleRange("month", "2026-10-21", TZ).days;

function event(
  id: string,
  startsAt: string,
  endsAt: string,
  extra: Partial<CalendarEventItem> = {},
): CalendarEventItem {
  return {
    id,
    title: id,
    startsAt,
    endsAt,
    allDay: false,
    color: "#A0C4FF",
    calendarId: "cal",
    categoryId: null,
    ...extra,
  };
}

function renderMonth(events: CalendarEventItem[] = []) {
  render(
    <MonthView
      date="2026-10-21"
      days={DAYS}
      events={events}
      timeZone={TZ}
      today={TODAY}
    />,
  );
}

function cell(date: string) {
  return screen
    .getAllByTestId("day-cell")
    .find((el) => el.getAttribute("data-date") === date)!;
}

describe("MonthView (RF-29, RF-37..RF-39)", () => {
  it("shows full weeks starting on Monday", () => {
    renderMonth();

    const cells = screen.getAllByTestId("day-cell");
    expect(cells).toHaveLength(35);
    expect(cells[0]).toHaveAttribute("data-date", "2026-09-28");
    expect(cells.at(-1)).toHaveAttribute("data-date", "2026-11-01");
    expect(screen.getByText("lun")).toBeInTheDocument();
    expect(screen.getByText("dom")).toBeInTheDocument();
  });

  it("marks today", () => {
    renderMonth();

    expect(
      within(cell("2026-10-21")).getByRole("link", {
        name: "miércoles, 21 de octubre de 2026",
      }),
    ).toHaveAttribute("aria-current", "date");
    expect(
      within(cell("2026-10-22")).getByRole("link").getAttribute("aria-current"),
    ).toBeNull();
  });

  it("opens the day view when a day is pressed (RF-37)", () => {
    renderMonth();

    expect(
      within(cell("2026-10-14")).getByRole("link", {
        name: "miércoles, 14 de octubre de 2026",
      }),
    ).toHaveAttribute("href", "/dashboard/calendar?view=day&date=2026-10-14");
  });

  it("shows an event in its color, with its time in the profile zone (RF-17, RF-34)", () => {
    renderMonth([
      event("Clase", "2026-10-14T06:00:00Z", "2026-10-14T07:00:00Z"),
    ]);

    const chip = within(cell("2026-10-14")).getByRole("link", {
      name: /Clase/,
    });
    expect(chip).toHaveTextContent("08:00");
    expect(chip).toHaveAttribute("href", "/dashboard/events/Clase");
    // The color is a bar; the text stays in ink (spec 005 RF-4).
    expect(chip).toHaveStyle({ borderLeftColor: "#A0C4FF" });
  });

  it("shows multi-day and all-day events in every day they occupy (RF-21)", () => {
    renderMonth([
      event("Viaje", "2026-10-20T00:00:00Z", "2026-10-23T00:00:00Z", {
        allDay: true,
      }),
    ]);

    for (const date of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
      expect(
        within(cell(date)).getByRole("link", { name: /Viaje/ }),
      ).toBeVisible();
    }
    expect(
      within(cell("2026-10-23")).queryByRole("link", { name: /Viaje/ }),
    ).toBeNull();
  });

  it("shows three events and a +N más link to the day view (RF-39)", () => {
    const events = [1, 2, 3, 4, 5].map((n) =>
      event(`E${n}`, `2026-10-14T0${n}:00:00Z`, `2026-10-14T0${n}:30:00Z`),
    );
    renderMonth(events);

    const day = within(cell("2026-10-14"));
    expect(day.getAllByRole("link", { name: /^\d{2}:\d{2} E\d/ })).toHaveLength(
      3,
    );
    expect(day.getByRole("link", { name: "+2 más" })).toHaveAttribute(
      "href",
      "/dashboard/calendar?view=day&date=2026-10-14",
    );
  });

  it("says there are no events when the period is empty (RF-38)", () => {
    renderMonth();

    expect(screen.getByText("No hay eventos")).toBeInTheDocument();
  });

  it("does not say it when there are events", () => {
    renderMonth([event("A", "2026-10-14T06:00:00Z", "2026-10-14T07:00:00Z")]);

    expect(screen.queryByText("No hay eventos")).not.toBeInTheDocument();
  });
});

// Spec 008, T15: creating from an empty day of the month (RF-19, RF-21, RF-22, RF-40).
describe("MonthView: creating", () => {
  it("makes the empty space of each day a button, reachable by keyboard (RF-19, RF-22)", async () => {
    const onCreate = vi.fn();
    render(
      <MonthView
        date="2026-10-21"
        days={DAYS}
        events={[]}
        timeZone={TZ}
        today={TODAY}
        onCreate={onCreate}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "Crear evento el jueves, 22 de octubre de 2026",
      }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      "2026-10-22",
      expect.objectContaining({ left: expect.any(Number) }),
    );
  });

  it("keeps the day number as a link to the day view (RF-21)", () => {
    render(
      <MonthView
        date="2026-10-21"
        days={DAYS}
        events={[]}
        timeZone={TZ}
        today={TODAY}
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("link", { name: "jueves, 22 de octubre de 2026" }),
    ).toHaveAttribute("href", "/dashboard/calendar?view=day&date=2026-10-22");
  });

  it("offers no buttons without permission to create (RF-36)", () => {
    renderMonth();

    expect(
      screen.queryByRole("button", { name: /Crear evento el/ }),
    ).toBeNull();
  });

  it("draws the provisional event in its day (RF-40)", () => {
    const { rerender } = render(
      <MonthView
        date="2026-10-21"
        days={DAYS}
        events={[]}
        timeZone={TZ}
        today={TODAY}
        onCreate={vi.fn()}
        draft={{ day: "2026-10-22", title: "" }}
      />,
    );
    const cell = screen
      .getAllByTestId("day-cell")
      .find((element) => element.dataset.date === "2026-10-22")!;
    expect(within(cell).getByText("(Sin título)")).toBeVisible();

    rerender(
      <MonthView
        date="2026-10-21"
        days={DAYS}
        events={[]}
        timeZone={TZ}
        today={TODAY}
        onCreate={vi.fn()}
        draft={{ day: "2026-10-22", title: "Cena" }}
      />,
    );
    expect(within(cell).getByText("Cena")).toBeVisible();
  });
});
