import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  EventReminders,
  ReminderField,
} from "@/components/calendar/reminder-field";

// Spec 040, T6: up to 3 reminders in the form and "Avisarme" in the detail
// (RF-5 to RF-7).
const hidden = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[name="reminders"]')!.value;

describe("ReminderField", () => {
  it("starts with the default of the kind of event and follows it", () => {
    const { container, rerender } = render(
      <ReminderField allDay={false} defaults={{ timed: 10, allDay: 1440 }} />,
    );
    expect(screen.getByLabelText("Aviso 1")).toHaveValue("10");
    expect(hidden(container)).toBe("10");
    rerender(<ReminderField allDay defaults={{ timed: 10, allDay: 1440 }} />);
    expect(screen.getByLabelText("Aviso 1")).toHaveValue("1440");
    expect(
      screen.getByRole("option", { name: "El día anterior a las 9:00" }),
    ).toBeInTheDocument();
  });

  it("adds up to 3, removes them and sends none", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ReminderField allDay={false} initial={[10]} />,
    );
    await user.click(screen.getByRole("button", { name: "Añadir aviso" }));
    await user.selectOptions(screen.getByLabelText("Aviso 2"), "60");
    await user.click(screen.getByRole("button", { name: "Añadir aviso" }));
    expect(
      screen.queryByRole("button", { name: "Añadir aviso" }),
    ).not.toBeInTheDocument();
    expect(hidden(container).split(",")).toHaveLength(3);

    for (let i = 0; i < 3; i += 1) {
      await user.click(
        screen.getByRole("button", { name: "Quitar el aviso 1" }),
      );
    }
    expect(screen.getByText("Sin avisos")).toBeInTheDocument();
    expect(hidden(container)).toBe("none");
  });
});

describe("EventReminders", () => {
  it("saves each change at once and says so", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({}));
    render(
      <EventReminders eventId="e1" allDay={false} initial={[]} save={save} />,
    );
    expect(screen.getByRole("group", { name: "Avisarme" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Añadir aviso" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith("e1", [10]));
    expect(await screen.findByText("Guardado.")).toBeInTheDocument();
  });

  it("goes back and explains when saving fails", async () => {
    const user = userEvent.setup();
    const save = vi.fn(async () => ({ error: "No se han podido guardar." }));
    render(
      <EventReminders eventId="e1" allDay={false} initial={[30]} save={save} />,
    );
    await user.click(screen.getByRole("button", { name: "Quitar el aviso 1" }));
    expect(
      await screen.findByText("No se han podido guardar."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Aviso 1")).toHaveValue("30");
  });
});
