import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityFilter } from "@/components/calendar/availability-filter";

// Spec 020, T6: the "Disponibilidad" section of the filters (RF-5, RF-6, RF-17, D5).
const person = (n: number, shown = false) => ({
  id: `0000000${n}-0000-4000-8000-000000000000`,
  name: `Persona ${n}`,
  shown,
});

describe("AvailabilityFilter", () => {
  it("is not there when nobody shares their busy times (RF-5)", () => {
    const { container } = render(
      <AvailabilityFilter people={[]} onToggle={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists each person with an avatar and an unmarked box (RF-5, RF-6)", () => {
    render(
      <AvailabilityFilter
        people={[{ ...person(1), name: "Ana García" }]}
        onToggle={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Disponibilidad" }),
    ).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: /Ana García/ });
    expect(box).not.toBeChecked();
    expect(screen.getByText("AG")).toBeInTheDocument();
  });

  it("marks and unmarks with the keyboard (RF-6)", async () => {
    const onToggle = vi.fn();
    render(
      <AvailabilityFilter
        people={[person(1), person(2, true)]}
        onToggle={onToggle}
      />,
    );
    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onToggle).toHaveBeenCalledWith(person(1).id, true);
    await userEvent.click(screen.getByRole("checkbox", { name: /Persona 2/ }));
    expect(onToggle).toHaveBeenCalledWith(person(2).id, false);
  });

  it("allows eight people at a time (D5)", () => {
    const people = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => person(n, true));
    render(
      <AvailabilityFilter people={[...people, person(9)]} onToggle={vi.fn()} />,
    );
    expect(screen.getByRole("checkbox", { name: /Persona 9/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Persona 8/ })).toBeEnabled();
    expect(
      screen.getByText("Como mucho 8 personas a la vez"),
    ).toBeInTheDocument();
  });
});
