import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilitySetting } from "@/components/settings/availability-setting";

// Spec 015, T10: the consent to show availability (RF-20, RF-21).
const LABEL = "Permitir que el asistente de otros consulte mi disponibilidad";

describe("AvailabilitySetting", () => {
  it("is unchecked by default and explains that only free or busy is shown (RF-20)", () => {
    render(<AvailabilitySetting current={false} save={vi.fn()} />);
    expect(screen.getByRole("switch", { name: LABEL })).not.toBeChecked();
    expect(
      screen.getByText(/solo si estás libre u ocupado/),
    ).toBeInTheDocument();
  });

  it("saves the change at once", async () => {
    const save = vi.fn(async () => ({}));
    render(<AvailabilitySetting current={false} save={save} />);
    await userEvent.click(screen.getByRole("switch", { name: LABEL }));
    expect(save).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch", { name: LABEL })).toBeChecked();
  });

  it("undoes the change and shows the error when saving fails (RF-21)", async () => {
    const save = vi.fn(async () => ({ error: "No se ha podido guardar." }));
    render(<AvailabilitySetting current save={save} />);
    await userEvent.click(screen.getByRole("switch", { name: LABEL }));
    expect(
      await screen.findByText("No se ha podido guardar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: LABEL })).toBeChecked();
  });
});
