import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "@/components/ui/switch";
import { contrastRatio } from "@/lib/calendar/palette";
import { DARK_NEUTRALS, NEUTRALS } from "@/lib/theme/accents";

// Spec 021, T7: the switch (RF-40..RF-46, plan D10).
function Harness({
  onChange = vi.fn(),
  disabled = false,
  fail = false,
}: {
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  fail?: boolean;
}) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <>
      <Switch
        label="Mostrar fines de semana"
        description="Sábado y domingo en la semana y el mes."
        checked={on}
        disabled={disabled}
        onCheckedChange={async (next) => {
          onChange(next);
          setOn(next);
          if (fail) {
            await Promise.resolve();
            setOn(!next);
            setError("No se ha podido guardar.");
          }
        }}
      />
      {error ? <p role="alert">{error}</p> : null}
    </>
  );
}

const control = () =>
  screen.getByRole("switch", { name: "Mostrar fines de semana" });

describe("Switch", () => {
  it("is a named switch with its state and description (RF-40, RF-41)", () => {
    render(<Harness />);
    expect(control()).toHaveAttribute("aria-checked", "false");
    expect(control()).toHaveAccessibleDescription(
      "Sábado y domingo en la semana y el mes.",
    );
  });

  it("changes with a click, Space and Enter (RF-42)", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(control());
    expect(control()).toBeChecked();
    control().focus();
    await userEvent.keyboard(" ");
    expect(control()).not.toBeChecked();
    await userEvent.keyboard("{Enter}");
    expect(control()).toBeChecked();
    expect(onChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("does not change while disabled", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} disabled />);
    await userEvent.click(control());
    expect(onChange).not.toHaveBeenCalled();
    expect(control()).not.toBeChecked();
  });

  it("goes back and shows the error when saving fails (RF-45)", async () => {
    render(<Harness fail />);
    await userEvent.click(control());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido guardar.",
    );
    expect(control()).not.toBeChecked();
  });

  it("is a 44 px target with the knob on the side of its state (RF-44, RF-46)", async () => {
    render(<Harness />);
    expect(control()).toHaveClass("min-h-11");
    const knob = control().querySelector("[data-knob]")!;
    expect(knob).toHaveClass("translate-x-0.75");
    await userEvent.click(control());
    expect(knob).toHaveClass("translate-x-5.75");
  });

  it.each([
    ["light", NEUTRALS],
    ["dark", DARK_NEUTRALS],
  ])("keeps 3:1 for the track and the knob in the %s theme (RF-46)", (_, n) => {
    // Off: control track on paper, paper knob. On: ink track, paper knob.
    expect(contrastRatio(n.control, n.paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(n.control, n.stone)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(n.ink, n.paper)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(n.ink, n.stone)).toBeGreaterThanOrEqual(3);
  });
});
