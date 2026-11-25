import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemDueMenu } from "@/components/notes/item-due-menu";

// Spec 048 T2: the due date of an item (RF-1).
function setup(due: { dueDate?: string | null; dueTime?: string | null } = {}) {
  const onChange = vi.fn();
  render(
    <ItemDueMenu
      text="Pan"
      dueDate={due.dueDate ?? null}
      dueTime={due.dueTime ?? null}
      today="2026-11-25"
      onChange={onChange}
    />,
  );
  return onChange;
}

const open = () =>
  userEvent.click(screen.getByRole("button", { name: "Fecha de «Pan»" }));

describe("ItemDueMenu", () => {
  it.each([
    ["Hoy", "2026-11-25"],
    ["Mañana", "2026-11-26"],
    ["Próxima semana", "2026-11-30"],
  ])("%s sets the date and closes", async (name, date) => {
    const onChange = setup();
    await open();
    await userEvent.click(screen.getByRole("button", { name }));
    expect(onChange).toHaveBeenCalledWith({ dueDate: date, dueTime: null });
    expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("takes another date with an optional time", async () => {
    const onChange = setup();
    await open();
    await userEvent.type(screen.getByLabelText("Otra fecha"), "2026-12-24");
    await userEvent.type(screen.getByLabelText("Hora (opcional)"), "18:30");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar fecha" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      dueDate: "2026-12-24",
      dueTime: "18:30",
    });
  });

  it("removes the date it has, and closes with Escape", async () => {
    const onChange = setup({ dueDate: "2026-11-26" });
    const button = screen.getByRole("button", { name: "Fecha de «Pan»" });
    await open();
    expect(button).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Quitar fecha" }));
    expect(onChange).toHaveBeenCalledWith({ dueDate: null, dueTime: null });
  });
});
