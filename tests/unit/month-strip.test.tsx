import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MonthStrip } from "@/components/calendar/month-strip";

// Spec 016, T6: the row of months under the header (RF-20..RF-22).
describe("MonthStrip", () => {
  it("links each month to its month view and marks the visible one", () => {
    render(<MonthStrip month="2026-11" />);

    const nav = screen.getByRole("navigation", { name: "Meses" });
    expect(nav).toBeInTheDocument();
    const current = screen.getByRole("link", { current: "date" });
    expect(current).toHaveAttribute(
      "href",
      "/dashboard/calendar?view=month&date=2026-11-01",
    );
    expect(screen.getAllByRole("link")).toHaveLength(37);
    expect(screen.getByText("2027")).toBeInTheDocument();
  });
});
