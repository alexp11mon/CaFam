import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TimeField } from "@/components/ui/time-field";
import { endOptions, startOptions } from "@/lib/calendar/time-options";

// Spec 008, T8: hour field with a list every 30 minutes (RF-13..RF-16, RF-49).
function Field({
  initial = "09:00",
  options = startOptions(),
}: {
  initial?: string;
  options?: { value: string; label: string }[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <form>
      <TimeField
        label="Hora de inicio"
        name="startTime"
        value={value}
        onValueChange={setValue}
        options={options}
      />
      <output>{value}</output>
    </form>
  );
}

const field = () => screen.getByRole("combobox", { name: "Hora de inicio" });

describe("TimeField", () => {
  it("opens the list on focus (RF-13)", async () => {
    render(<Field />);
    expect(field()).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(field());

    expect(field()).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(48);
    // The current value is the active option.
    expect(within(list).getByRole("option", { name: "09:00" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("writes the clicked time and closes (RF-14)", async () => {
    render(<Field />);
    await userEvent.click(field());

    await userEvent.click(screen.getByRole("option", { name: "10:30" }));

    expect(field()).toHaveValue("10:30");
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("moves with the arrows and picks with Enter without sending the form", async () => {
    render(<Field />);
    await userEvent.click(field());

    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(field()).toHaveValue("10:00");
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without changing the value nor closing a window (RF-15)", async () => {
    render(<Field />);
    await userEvent.click(field());
    await userEvent.keyboard("{ArrowDown}");

    const escape = fireEvent.keyDown(field(), { key: "Escape" });

    expect(escape).toBe(false); // default prevented: the dialog does not close
    expect(field()).toHaveValue("09:00");
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("accepts a typed time outside the list and tidies it on leaving (RF-16)", async () => {
    render(<Field />);
    await userEvent.clear(field());
    await userEvent.type(field(), "9:15");

    await userEvent.tab();

    expect(field()).toHaveValue("09:15");
  });

  it("leaves an invalid text as typed for the server to reject", async () => {
    render(<Field />);
    await userEvent.clear(field());
    await userEvent.type(field(), "25:00");

    await userEvent.tab();

    expect(field()).toHaveValue("25:00");
  });

  it("shows the durations of the end list (RF-49)", async () => {
    render(<Field initial="11:00" options={endOptions("10:00")} />);

    await userEvent.click(field());

    expect(screen.getByRole("option", { name: "11:00 (1 h)" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
