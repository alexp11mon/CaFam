import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayView } from "@/components/calendar/day-view";
import type { CalendarEventItem } from "@/lib/calendar/layout";

const TZ = "Europe/Madrid";

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
    color: "#FFADAD",
    calendarId: "cal",
    categoryId: null,
    ...extra,
  };
}

function renderDay(events: CalendarEventItem[] = []) {
  render(
    <DayView
      day="2026-10-21"
      events={events}
      timeZone={TZ}
      today="2026-10-21"
    />,
  );
}

describe("DayView (RF-29, RF-35, RF-38, RF-40)", () => {
  it("shows a single day column", () => {
    renderDay();

    expect(screen.getAllByTestId("day-header")).toHaveLength(1);
    expect(screen.getByTestId("day-header")).toHaveTextContent("mié");
  });

  it("shows timed events at their local time and all-day events in the strip", () => {
    renderDay([
      event("Reunión", "2026-10-21T13:00:00Z", "2026-10-21T14:00:00Z"),
      event("Cumpleaños", "2026-10-21T00:00:00Z", "2026-10-22T00:00:00Z", {
        allDay: true,
      }),
    ]);

    const slot = screen.getByRole("link", { name: /Reunión/ });
    expect(slot).toHaveTextContent("15:00");
    expect(slot.style.top).toBe("720px"); // 15 h * 48 px
    expect(
      within(screen.getByTestId("banner-strip")).getByRole("link", {
        name: /Cumpleaños/,
      }),
    ).toBeVisible();
  });

  it("puts overlapping events side by side (RF-40)", () => {
    renderDay([
      event("A", "2026-10-21T07:00:00Z", "2026-10-21T09:00:00Z"),
      event("B", "2026-10-21T08:00:00Z", "2026-10-21T09:00:00Z"),
      event("C", "2026-10-21T08:30:00Z", "2026-10-21T09:30:00Z"),
    ]);

    const widths = ["A", "B", "C"].map(
      (name) =>
        screen.getByRole("link", { name: new RegExp(name) }).style.width,
    );
    expect(widths).toEqual(["33.3333%", "33.3333%", "33.3333%"]);
  });

  it("says there are no events when the day is empty (RF-38)", () => {
    renderDay();

    expect(screen.getByText("No hay eventos")).toBeInTheDocument();
  });
});
