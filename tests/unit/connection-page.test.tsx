import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarPicker } from "@/components/connections/calendar-picker";
import { SyncNowButton } from "@/components/connections/sync-now-button";
import { SyncStatus } from "@/components/connections/sync-status";

// Spec 007, T9: choosing calendars, their state and "Actualizar ahora" (RF-9
// to RF-14, RF-23, RF-24, RF-26).
const google = (n: number, synced = false) => ({
  id: `g-${n}`,
  name: `Calendario ${n}`,
  color: "#9fe1e7",
  synced,
});

describe("CalendarPicker", () => {
  it("lists the calendars with the synced ones checked (RF-9, RF-12)", () => {
    render(
      <CalendarPicker
        connectionId="c1"
        calendars={[google(1, true), google(2)]}
        action={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Calendario 1" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Calendario 2" }),
    ).not.toBeChecked();
  });

  it("disables the rest at 20 calendars and says why (RF-14)", () => {
    const calendars = [
      ...Array.from({ length: 20 }, (_, i) => google(i, true)),
      google(99),
    ];
    render(
      <CalendarPicker
        connectionId="c1"
        calendars={calendars}
        action={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Calendario 99" }),
    ).toBeDisabled();
    expect(screen.getByText(/máximo de 20/i)).toBeInTheDocument();
  });

  it("asks what to do with an unchecked calendar before saving (RF-11)", async () => {
    const user = userEvent.setup();
    render(
      <CalendarPicker
        connectionId="c1"
        calendars={[google(1, true)]}
        action={vi.fn()}
      />,
    );
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Calendario 1" }));

    const group = screen.getByRole("group", { name: /dejas de traer/i });
    const keep = within(group).getByRole("radio", { name: /conservar/i });
    const remove = within(group).getByRole("radio", { name: /borrar/i });
    expect(keep).not.toBeChecked();
    expect(remove).not.toBeChecked();
    expect(keep).toBeRequired();
  });

  it("sends the connection and the chosen calendars", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ message: "Guardado." }));
    render(
      <CalendarPicker
        connectionId="c1"
        calendars={[google(1), google(2)]}
        action={action}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Calendario 2" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Guardado.")).toBeInTheDocument();
    const data = (action.mock.calls[0] as unknown[])[1] as FormData;
    expect(data.get("connectionId")).toBe("c1");
    expect(data.getAll("calendar").map((v) => JSON.parse(String(v)))).toEqual([
      { id: "g-2", name: "Calendario 2", color: "#9fe1e7", access: null },
    ]);
  });
});

describe("SyncStatus (RF-13, RF-26)", () => {
  it("shows the last good update, failures and missing calendars", () => {
    render(
      <SyncStatus
        timeZone="Europe/Madrid"
        calendars={[
          {
            calendarId: "a",
            name: "Trabajo",
            state: "active",
            lastSyncedAt: "2026-10-27T10:05:00Z",
            lastError: null,
            lastSummary: { added: 2, changed: 0, removed: 1 },
          },
          {
            calendarId: "b",
            name: "Viejo",
            state: "missing",
            lastSyncedAt: null,
            lastError: "missing",
            lastSummary: null,
          },
          {
            calendarId: "c",
            name: "Caído",
            state: "active",
            lastSyncedAt: null,
            lastError: "transient",
            lastSummary: null,
          },
        ]}
      />,
    );

    const [trabajo, viejo, caido] = screen.getAllByRole("listitem");
    expect(trabajo).toHaveTextContent("27 oct");
    expect(trabajo).toHaveTextContent("11:05");
    expect(trabajo).toHaveTextContent("2 añadidos");
    expect(viejo).toHaveTextContent(/ya no existe en la cuenta/i);
    expect(caido).toHaveTextContent(/falló/i);
    expect(caido).toHaveTextContent(/todavía no/i);
  });
});

describe("SyncNowButton (RF-23, RF-24)", () => {
  it("shows the result of the update", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({
      message: "Podrás volver a actualizar dentro de 3 minutos.",
    }));
    render(<SyncNowButton action={action} />);

    await user.click(screen.getByRole("button", { name: "Actualizar ahora" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "dentro de 3 minutos",
    );
  });
});
