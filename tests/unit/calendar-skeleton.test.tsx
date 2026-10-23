import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarSkeleton } from "@/components/calendar/calendar-skeleton";

// Spec 008, T20: a loading structure with the shape of the view (RF-33).
describe("CalendarSkeleton", () => {
  it.each([
    ["agenda", "agenda-row", 4],
    ["month", "month-cell", 35],
    ["week", "grid-column", 7],
    ["day", "grid-column", 1],
  ] as const)("draws the %s view while it loads", (view, part, count) => {
    render(<CalendarSkeleton view={view} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAccessibleName("Cargando calendario…");
    expect(screen.getAllByTestId(`skeleton-${part}`)).toHaveLength(count);
  });
});
