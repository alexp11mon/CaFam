import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekView } from "@/components/calendar/week-view";
import type { CalendarEventItem } from "@/lib/calendar/layout";
import { getVisibleRange } from "@/lib/calendar/ranges";

const TZ = "Europe/Madrid";
const TODAY = "2026-10-21";
const DAYS = getVisibleRange("week", "2026-10-21", TZ).days;

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

function renderWeek(events: CalendarEventItem[] = []) {
  render(<WeekView days={DAYS} events={events} timeZone={TZ} today={TODAY} />);
}

describe("WeekView (RF-29, RF-35, RF-40)", () => {
  it("has a header per day linking to the day view, with today marked", () => {
    renderWeek();

    const headers = screen.getAllByTestId("day-header");
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent("L");
    expect(within(headers[0]!).getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/calendar?view=day&date=2026-10-19",
    );
    expect(within(headers[2]!).getByRole("link")).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("marks events with images, with the icon only in blocks of 30 min or more (spec 012 RF-12)", () => {
    renderWeek([
      event("Largo", "2026-10-21T08:00:00Z", "2026-10-21T09:00:00Z", {
        imageCount: 1,
      }),
      event("Corto", "2026-10-21T10:00:00Z", "2026-10-21T10:15:00Z", {
        imageCount: 1,
      }),
      event("Nada", "2026-10-21T12:00:00Z", "2026-10-21T13:00:00Z"),
    ]);
    const long = screen.getByRole("link", { name: /Largo/ });
    const short = screen.getByRole("link", { name: /Corto/ });
    expect(long).toHaveTextContent("Con imágenes");
    expect(long.querySelector("svg")).not.toBeNull();
    expect(short).toHaveTextContent("Con imágenes");
    expect(short.querySelector("svg")).toBeNull();
    expect(screen.getByRole("link", { name: /Nada/ })).not.toHaveTextContent(
      "Con imágenes",
    );
  });

  it("places timed events by their time in the profile zone (RF-34)", () => {
    // 07:30Z-09:00Z is 08:30-10:00 in Madrid (UTC+2 until 25 Oct).
    renderWeek([
      event("Clase", "2026-10-21T06:30:00Z", "2026-10-21T08:00:00Z"),
    ]);

    const slot = screen.getByRole("link", { name: /Clase/ });
    expect(slot).toHaveTextContent("08:30");
    expect(slot.style.top).toBe("408px"); // 8.5 h * 48 px
    expect(slot.style.height).toBe("72px"); // 1.5 h * 48 px
    // A block filled with its color (spec 016 RF-41).
    expect(slot).toHaveStyle({ backgroundColor: "#A0C4FF" });
  });

  it("puts overlapping events side by side without covering each other (RF-40)", () => {
    renderWeek([
      event("A", "2026-10-21T07:00:00Z", "2026-10-21T08:00:00Z"),
      event("B", "2026-10-21T07:30:00Z", "2026-10-21T08:30:00Z"),
    ]);

    const a = screen.getByRole("link", { name: /A/ });
    const b = screen.getByRole("link", { name: /B/ });
    expect([a.style.left, a.style.width]).toEqual(["0%", "50%"]);
    expect([b.style.left, b.style.width]).toEqual(["50%", "50%"]);
  });

  it("shows all-day and multi-day events in a separate strip, not in the grid (RF-35)", () => {
    renderWeek([
      event("Viaje", "2026-10-20T00:00:00Z", "2026-10-22T00:00:00Z", {
        allDay: true,
      }),
    ]);

    const strip = screen.getByTestId("banner-strip");
    // One continuous block over its two days (spec 016 RF-40).
    expect(within(strip).getAllByRole("link", { name: /Viaje/ })).toHaveLength(
      1,
    );
    expect(
      within(screen.getByTestId("time-grid")).queryByRole("link"),
    ).toBeNull();
  });

  it("splits an event crossing midnight over both days (casos límite)", () => {
    renderWeek([
      event("Noche", "2026-10-20T21:00:00Z", "2026-10-21T00:00:00Z"),
    ]);

    const slots = screen.getAllByRole("link", { name: /Noche/ });
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.style.top)).toEqual(["1104px", "0px"]);
  });

  it("labels the hours", () => {
    renderWeek();

    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("23:00")).toBeInTheDocument();
  });

  it("says there are no events when the week is empty (RF-38)", () => {
    renderWeek();

    expect(screen.getByText("No hay eventos")).toBeInTheDocument();
  });
});
