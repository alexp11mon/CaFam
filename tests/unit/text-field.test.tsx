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
