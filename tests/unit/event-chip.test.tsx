import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventChip } from "@/components/calendar/event-chip";
import type { CalendarEventItem } from "@/lib/calendar/layout";

// Spec 008, T17: in the month a timed event is a dot, an all-day one a bar (RF-48, plan D9).
const TZ = "Europe/Madrid";

const TIMED: CalendarEventItem = {
  id: "e1",
  title: "Cena familiar",
  startsAt: "2026-10-22T19:00:00Z",
  endsAt: "2026-10-22T20:00:00Z",
  allDay: false,
  color: "#FFADAD",
  calendarId: "cal",
  categoryId: null,
};

const ALL_DAY: CalendarEventItem = {
  ...TIMED,
  id: "e2",
  title: "Excursión",
  startsAt: "2026-10-27T00:00:00Z",
  endsAt: "2026-10-28T00:00:00Z",
  allDay: true,
};

describe("EventChip variants of the month", () => {
  it("draws a timed event as a dot of its color, the hour and the title, unfilled", () => {
    render(<EventChip event={TIMED} timeZone={TZ} variant="dot" />);

    const link = screen.getByRole("link", { name: "21:00 Cena familiar" });
    expect(link).toHaveAttribute("href", "/dashboard/events/e1");
    expect(link.style.backgroundColor).toBe("");
    expect(screen.getByTestId("event-dot")).toHaveStyle({
      backgroundColor: "#FFADAD",
    });
  });

  it("draws an all-day event as a bar filled with its color, text in pastel ink", () => {
    render(<EventChip event={ALL_DAY} timeZone={TZ} variant="bar" />);

    const link = screen.getByRole("link", { name: "Excursión" });
    expect(link).toHaveStyle({ backgroundColor: "#FFADAD" });
    expect(link.className).toMatch(/\btext-pastel-ink\b/);
  });
});
