import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui/select";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";

// Spec 011, T10: the focus ring of the fields fades in instead of jumping
// (RF-16; plan micro).
const FADE = "transition-[border-color,box-shadow]";

describe("field focus transition (RF-16)", () => {
  it("TextField", () => {
    render(<TextField label="Título" name="title" />);
    expect(screen.getByLabelText("Título")).toHaveClass(FADE);
  });

  it("TextArea", () => {
    render(<TextArea label="Descripción" name="description" />);
    expect(screen.getByLabelText("Descripción")).toHaveClass(FADE);
  });

  it("Select", () => {
    render(
      <Select label="Calendario" name="calendar">
        <option value="a">Mi calendario</option>
      </Select>,
    );
    expect(screen.getByLabelText("Calendario")).toHaveClass(FADE);
  });
});

// Spec 023, T12: a hint under the field, read with it (RF-24).
describe("TextField hint", () => {
  it("is linked to the input, next to the error", () => {
    const { rerender } = render(
      <TextField
        label="Contraseña"
        name="password"
        hint="Mínimo 8 caracteres"
      />,
    );
    const input = screen.getByLabelText("Contraseña");
    expect(input).toHaveAccessibleDescription("Mínimo 8 caracteres");

    rerender(
      <TextField
        label="Contraseña"
        name="password"
        hint="Mínimo 8 caracteres"
        error="Es demasiado corta"
      />,
    );
    expect(input).toHaveAccessibleDescription(
      "Mínimo 8 caracteres Es demasiado corta",
    );
  });
});
