import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { RepeatField } from "@/components/recurrence/repeat-field";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

/** The field inside a form whose start date can change. */
function Harness({
  defaultValue = "none",
  disabledReason,
}: {
  defaultValue?: string;
  disabledReason?: string;
}) {
  const [date, setDate] = useState("2026-11-10");
  return (
    <form aria-label="Evento">
      <input
        aria-label="Fecha de inicio"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <RepeatField
        startDate={date}
        allDay={false}
        defaultValue={defaultValue}
        disabledReason={disabledReason}
      />
    </form>
  );
}

function submitted() {
  const form = screen.getByRole("form", { name: "Evento" }) as HTMLFormElement;
  return new FormData(form).get("repeat");
}

describe("RepeatField (RF-1, RF-2, RF-29)", () => {
  it("defaults to 'No se repite'", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Repetir")).toHaveDisplayValue("No se repite");
    expect(submitted()).toBe("none");
  });

  it("offers the options of the start date, which follow its changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.getByRole("option", { name: "Cada semana el martes" }),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Repetir"), "weekly");
    expect(submitted()).toBe("weekly");

    const date = screen.getByLabelText("Fecha de inicio");
    await user.clear(date);
    await user.type(date, "2026-11-12");
    expect(screen.getByLabelText("Repetir")).toHaveDisplayValue(
      "Cada semana el jueves",
    );
    expect(submitted()).toBe("weekly");
  });

  it("falls back to 'No se repite' when the option no longer exists", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const date = screen.getByLabelText("Fecha de inicio");
    await user.clear(date);
    await user.type(date, "2026-11-24");
    await user.selectOptions(screen.getByLabelText("Repetir"), "monthly-last");
    await user.clear(date);
    await user.type(date, "2026-11-10");
    expect(submitted()).toBe("none");
  });

  it("'Personalizado…' opens the editor and keeps the rule it returns", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText("Repetir"), "custom");
    expect(
      screen.getByRole("dialog", { name: "Repetición personalizada" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Tras" }));
    await user.click(screen.getByRole("button", { name: "Hecho" }));
    expect(submitted()).toBe("custom:FREQ=WEEKLY;INTERVAL=1;BYDAY=TU;COUNT=10");
    expect(screen.getByLabelText("Repetir")).toHaveDisplayValue(
      "Cada semana el martes, 10 veces",
    );
  });

  it("cancelling the editor keeps the previous choice", async () => {
    const user = userEvent.setup();
    render(<Harness defaultValue="daily" />);
    await user.selectOptions(screen.getByLabelText("Repetir"), "custom");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(submitted()).toBe("daily");
  });

  it("shows a saved custom rule", () => {
    render(
      <Harness defaultValue="custom:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=31" />,
    );
    expect(screen.getByLabelText("Repetir")).toHaveDisplayValue(
      "Cada mes el día 31",
    );
  });

  it("is disabled with the reason in a synced calendar (RF-29)", () => {
    render(
      <Harness
        defaultValue="weekly"
        disabledReason="Los calendarios de Google no admiten repeticiones en CaFam"
      />,
    );
    expect(screen.getByLabelText("Repetir")).toBeDisabled();
    expect(
      screen.getByText(
        "Los calendarios de Google no admiten repeticiones en CaFam",
      ),
    ).toBeInTheDocument();
    expect(submitted()).toBe("none");
  });
});
