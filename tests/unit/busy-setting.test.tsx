import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BusySetting } from "@/components/settings/busy-setting";

// Spec 020, T5: the consent to show busy times in other people's grid (RF-1 to RF-3).
const LABEL = "Mostrar a los demás cuándo estoy ocupado en su calendario";

describe("BusySetting", () => {
  it("is off by default and explains what the others see (RF-1, RF-3)", () => {
    render(<BusySetting current={false} save={vi.fn()} />);
    expect(screen.getByRole("switch", { name: LABEL })).not.toBeChecked();
    expect(screen.getByText(/bloques «Ocupado»/)).toBeInTheDocument();
    expect(
      screen.getByText(/sin título, lugar, descripción ni calendario/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/solo las personas con las que compartes/),
    ).toBeInTheDocument();
  });

  it("saves with its own action (RF-2)", async () => {
    const save = vi.fn(async () => ({}));
    render(<BusySetting current={false} save={save} />);
    await userEvent.click(screen.getByRole("switch", { name: LABEL }));
    expect(save).toHaveBeenCalledWith(true);
  });
});
