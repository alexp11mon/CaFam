import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WeekendToggle } from "@/components/calendar/weekend-toggle";
import { ViewToolbar } from "@/components/calendar/view-toolbar";

// Spec 019, T6: show the weekends again without going to Ajustes (RF-28).
const actions = vi.hoisted(() => ({
  setShowWeekends: vi.fn(async () => ({})),
}));
vi.mock("@/app/dashboard/settings/actions", () => actions);

describe("WeekendToggle", () => {
  it("shows the weekends again", async () => {
    render(<WeekendToggle />);

    await userEvent.click(
      screen.getByRole("button", { name: "Mostrar fines de semana" }),
    );

    expect(actions.setShowWeekends).toHaveBeenCalledWith(true);
  });

  it("says why if saving fails", async () => {
    actions.setShowWeekends.mockResolvedValueOnce({
      error: "No se ha podido guardar.",
    });
    render(<WeekendToggle />);

    await userEvent.click(
      screen.getByRole("button", { name: "Mostrar fines de semana" }),
    );

    expect(await screen.findByText("No se ha podido guardar.")).toBeVisible();
  });

  it("sits in the toolbar only while the weekends are hidden", () => {
    const { rerender } = render(
      <ViewToolbar view="week" date="2026-10-14" today="2026-10-21" />,
    );
    expect(
      screen.queryByRole("button", { name: "Mostrar fines de semana" }),
    ).toBeNull();

    rerender(
      <ViewToolbar
        view="week"
        date="2026-10-14"
        today="2026-10-21"
        showWeekends={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Mostrar fines de semana" }),
    ).toBeVisible();
  });
});
