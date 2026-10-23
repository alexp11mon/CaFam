import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { OrphanCalendarItem } from "@/components/account/orphan-calendar-item";
import type { OrphanCalendar } from "@/lib/account/queries";
import type { ConfirmState } from "@/lib/forms/form-state";

// Spec 006, T21: a member keeps or leaves a calendar without owner before the
// deadline (RF-24 to RF-26).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const CALENDAR: OrphanCalendar = {
  id: "cal-1",
  name: "Familia",
  color: "#A0C4FF",
  orphanedAt: "2026-11-01T10:00:00Z",
  decision: null,
};

function renderItem(
  overrides: Partial<OrphanCalendar> = {},
  daysLeft = 12,
  keepAction = vi.fn(async (): Promise<ConfirmState> => ({})),
  leaveAction = vi.fn(async (): Promise<ConfirmState> => ({})),
) {
  render(
    <OrphanCalendarItem
      calendar={{ ...CALENDAR, ...overrides }}
      daysLeft={daysLeft}
      keepAction={keepAction}
      leaveAction={leaveAction}
    />,
  );
  return { keepAction, leaveAction };
}

describe("OrphanCalendarItem (RF-24 to RF-26)", () => {
  it("shows the calendar and the days left to decide (RF-26)", () => {
    renderItem();

    expect(screen.getByText("Familia")).toBeInTheDocument();
    expect(
      screen.getByText("Quedan 12 días para decidir."),
    ).toBeInTheDocument();
  });

  it("uses the singular on the last day", () => {
    renderItem({}, 1);

    expect(screen.getByText("Queda 1 día para decidir.")).toBeInTheDocument();
  });

  it("keeps the calendar (RF-24)", async () => {
    const { keepAction } = renderItem();

    await userEvent.click(screen.getByRole("button", { name: "Conservar" }));

    expect(keepAction).toHaveBeenCalled();
  });

  it("asks before leaving the calendar (RF-25)", async () => {
    const { leaveAction } = renderItem();

    await userEvent.click(
      screen.getByRole("button", { name: "Salir de «Familia»" }),
    );
    expect(leaveAction).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Salir del calendario" }),
    );
    expect(leaveAction).toHaveBeenCalled();
  });

  it("says when the user already chose to keep it", () => {
    renderItem({ decision: true });

    expect(screen.getByText(/Has decidido conservarlo/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Conservar" }),
    ).not.toBeInTheDocument();
  });
});
