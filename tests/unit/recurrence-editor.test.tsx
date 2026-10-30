import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { RecurrenceEditor } from "@/components/recurrence/recurrence-editor";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

function setup(props: Partial<Parameters<typeof RecurrenceEditor>[0]> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <RecurrenceEditor
      open
      startDate="2026-11-24"
      allDay={false}
      initial={null}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onSave, onCancel, user: userEvent.setup() };
}

describe("RecurrenceEditor (RF-3, RF-4, RF-5)", () => {
  it("starts weekly on the weekday of the start, with a live summary", () => {
    setup();
    expect(
      screen.getByRole("dialog", { name: "Repetición personalizada" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Repetir cada")).toHaveValue(1);
    expect(screen.getByLabelText("Unidad")).toHaveValue("weekly");
    expect(screen.getByRole("checkbox", { name: "martes" })).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada semana el martes",
    );
  });

  it("every 2 weeks on Monday and Thursday, 10 times", async () => {
    const { user, onSave } = setup();
    const every = screen.getByLabelText("Repetir cada");
    await user.clear(every);
    await user.type(every, "2");
    await user.click(screen.getByRole("checkbox", { name: "martes" }));
    await user.click(screen.getByRole("checkbox", { name: "lunes" }));
    await user.click(screen.getByRole("checkbox", { name: "jueves" }));
    await user.click(screen.getByRole("radio", { name: "Tras" }));
    const count = screen.getByLabelText("Número de repeticiones");
    await user.clear(count);
    await user.type(count, "10");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada 2 semanas el lunes y el jueves, 10 veces",
    );
    await user.click(screen.getByRole("button", { name: "Hecho" }));
    expect(onSave).toHaveBeenCalledWith(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=10",
    );
  });

  it("monthly by day, by position or the last weekday", async () => {
    const { user, onSave } = setup();
    await user.selectOptions(screen.getByLabelText("Unidad"), "monthly");
    expect(screen.getByRole("radio", { name: "El día 24" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "El 4.º martes" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "El último martes" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada mes el último martes",
    );
    await user.click(screen.getByRole("button", { name: "Hecho" }));
    expect(onSave).toHaveBeenCalledWith("FREQ=MONTHLY;INTERVAL=1;BYDAY=-1TU");
  });

  it("ends on a date, included", async () => {
    const { user, onSave } = setup({ allDay: true });
    await user.selectOptions(screen.getByLabelText("Unidad"), "daily");
    await user.click(screen.getByRole("radio", { name: "El" }));
    const date = screen.getByLabelText("Fecha de fin de la repetición");
    await user.clear(date);
    await user.type(date, "2027-01-15");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada día, hasta el 15 de enero de 2027",
    );
    await user.click(screen.getByRole("button", { name: "Hecho" }));
    expect(onSave).toHaveBeenCalledWith("FREQ=DAILY;INTERVAL=1;UNTIL=20270115");
  });

  it("refuses intervals outside 1 to 99 and weeks without days", async () => {
    const { user } = setup();
    const every = screen.getByLabelText("Repetir cada");
    await user.clear(every);
    await user.type(every, "100");
    expect(screen.getByRole("button", { name: "Hecho" })).toBeDisabled();
    expect(
      screen.getByText("Revisa la repetición: cada 1 a 99, de 1 a 999 veces."),
    ).toBeInTheDocument();
    await user.clear(every);
    await user.type(every, "1");
    await user.click(screen.getByRole("checkbox", { name: "martes" }));
    expect(screen.getByRole("button", { name: "Hecho" })).toBeDisabled();
  });

  it("opens with a given rule and cancels", async () => {
    const { user, onCancel } = setup({
      initial: "FREQ=YEARLY;INTERVAL=2;BYMONTH=11;BYMONTHDAY=24;COUNT=3",
    });
    expect(screen.getByLabelText("Unidad")).toHaveValue("yearly");
    expect(screen.getByLabelText("Repetir cada")).toHaveValue(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada 2 años el 24 de noviembre, 3 veces",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("is usable with the keyboard alone", async () => {
    const { user, onSave } = setup();
    screen.getByLabelText("Repetir cada").focus();
    await user.keyboard("{Control>}a{/Control}3");
    await user.tab();
    expect(screen.getByLabelText("Unidad")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: "lunes" })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cada 3 semanas el lunes y el martes",
    );
    screen.getByRole("button", { name: "Hecho" }).focus();
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalledWith("FREQ=WEEKLY;INTERVAL=3;BYDAY=MO,TU");
  });
});
