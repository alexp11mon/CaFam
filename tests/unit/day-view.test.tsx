import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

// Spec 008, T16: creating on the hour grid (RF-20, RF-36, RF-40).
describe("DayView: creating", () => {
  it("listens for clicks and drags only for whoever can create (RF-36)", () => {
    const { rerender } = render(
      <DayView day="2026-10-21" events={[]} timeZone={TZ} today="2026-10-21" />,
    );
    expect(screen.queryByTestId("slot-layer")).toBeNull();

    rerender(
      <DayView
        day="2026-10-21"
        events={[]}
        timeZone={TZ}
        today="2026-10-21"
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByTestId("slot-layer")).toBeInTheDocument();
  });

  it("draws the provisional event at its hours (RF-40)", () => {
    render(
      <DayView
        day="2026-10-21"
        events={[]}
        timeZone={TZ}
        today="2026-10-21"
        onCreate={vi.fn()}
        draft={{
          day: "2026-10-21",
          startMinute: 16 * 60,
          endMinute: 17 * 60 + 30,
          title: "Cena",
        }}
      />,
    );

    const block = screen.getByTestId("draft-block");
    expect(block).toHaveTextContent("Cena");
    expect(block).toHaveTextContent("16:00 – 17:30");
    expect(block).toHaveStyle({ top: `${16 * 48}px`, height: `${1.5 * 48}px` });
  });
});
