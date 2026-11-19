import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 044, T5: the state of a calendar updated from a link (RF-6, RF-10).
const actions = vi.hoisted(() => ({
  refreshIcsSubscription: vi.fn(async () => ({
    message: "Calendario actualizado desde su enlace.",
  })),
  stopIcsSubscription: vi.fn(async () => ({
    message: "Ya no se actualiza desde el enlace. Los eventos se quedan.",
  })),
}));
vi.mock("@/app/dashboard/calendars/ics-actions", () => actions);
vi.mock("@/lib/hooks/use-now", () => ({
  useNow: () => Date.parse("2026-11-19T12:00:00Z"),
}));

import { IcsSubscriptionStatus } from "@/components/import/ics-subscription-status";
import type { IcsSubscriptionInfo } from "@/lib/ics/subscription-queries";

const ACTIVE: IcsSubscriptionInfo = {
  state: "active",
  lastReadAt: "2026-11-19T10:00:00Z",
  lastError: null,
};

function setup(info = ACTIVE, canWrite = true) {
  render(
    <IcsSubscriptionStatus
      calendarId="c1"
      calendarName="Colegio"
      info={info}
      canWrite={canWrite}
      timeZone="Europe/Madrid"
    />,
  );
}

beforeEach(() => {
  actions.refreshIcsSubscription.mockClear();
  actions.stopIcsSubscription.mockClear();
});

describe("IcsSubscriptionStatus", () => {
  it("says when it was updated and refreshes now", async () => {
    setup();
    expect(
      screen.getByText("Actualizado desde un enlace · hace 2 h"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Actualizar ahora Colegio" }),
    );
    expect(actions.refreshIcsSubscription).toHaveBeenCalledWith("c1");
    expect(
      await screen.findByText("Calendario actualizado desde su enlace."),
    ).toBeInTheDocument();
  });

  it("offers to retry a paused one, with the reason", async () => {
    setup({
      state: "paused",
      lastReadAt: ACTIVE.lastReadAt,
      lastError: "El enlace ya no existe.",
    });
    expect(
      screen.getByText(
        "La actualización desde un enlace está en pausa. Último fallo: El enlace ya no existe.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar Colegio" }),
    );
    expect(actions.refreshIcsSubscription).toHaveBeenCalledWith("c1");
  });

  it("stops updating and keeps the events", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Dejar de actualizar Colegio" }),
    );
    expect(actions.stopIcsSubscription).toHaveBeenCalledWith("c1");
    expect(
      await screen.findByText(
        "Ya no se actualiza desde el enlace. Los eventos se quedan.",
      ),
    ).toBeInTheDocument();
  });

  it("only shows the state to a Lector", () => {
    setup(ACTIVE, false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Actualizado desde un enlace/)).toBeInTheDocument();
  });
});
