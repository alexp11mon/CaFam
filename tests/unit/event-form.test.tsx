import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  EventForm,
  type EventFormValues,
} from "@/components/calendar/event-form";
import type { FormState } from "@/lib/forms/form-state";

type State = FormState<keyof EventFormValues>;

const CALENDARS = [
  { id: "cal-a", name: "Clases Uni", color: "#A0C4FF" },
  { id: "cal-b", name: "Familia", color: "#FFADAD" },
];

const CATEGORIES = [
  { id: "cat-1", name: "Matemáticas", calendarId: "cal-a" },
  { id: "cat-2", name: "Física", calendarId: "cal-a" },
  { id: "cat-3", name: "Cumpleaños", calendarId: "cal-b" },
];

const INITIAL: EventFormValues = {
  title: "",
  calendarId: "cal-a",
  allDay: "",
  startDate: "2026-11-02",
  startTime: "09:00",
  endDate: "2026-11-02",
  endTime: "10:00",
  description: "",
  location: "",
  color: "",
  categoryId: "",
};

function setup(
  implementation?: (prev: State, formData: FormData) => Promise<State>,
  initial: EventFormValues = INITIAL,
) {
  const action = vi.fn<(prev: State, formData: FormData) => Promise<State>>(
    implementation ?? (async () => ({ values: INITIAL })),
  );
  render(
    <EventForm
      action={action}
      initial={initial}
      calendars={CALENDARS}
      categories={CATEGORIES}
      submitLabel="Crear evento"
      pendingLabel="Creando…"
      cancelHref="/dashboard"
    />,
  );
  return action;
}

function optionNames(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("EventForm (RF-15, RF-16)", () => {
  it("has every field with a visible label", () => {
    setup();

    for (const label of [
      "Título",
      "Calendario",
      "Todo el día",
      "Fecha de inicio",
      "Hora de inicio",
      "Fecha de fin",
      "Hora de fin",
      "Descripción",
      "Lugar",
      "Categoría",
    ]) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
  });

  it("offers only the calendars it receives (RF-27)", () => {
    setup();

    expect(optionNames(screen.getByLabelText("Calendario"))).toEqual([
      "Clases Uni",
      "Familia",
    ]);
  });

  it("hides the times for all-day events and shows them again (RF-20)", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByLabelText("Todo el día"));

    expect(screen.queryByLabelText("Hora de inicio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hora de fin")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de inicio")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Todo el día"));
    expect(screen.getByLabelText("Hora de inicio")).toHaveValue("09:00");
  });

  it("filters the categories by the chosen calendar (RF-28)", async () => {
    const user = userEvent.setup();
    setup();

    expect(optionNames(screen.getByLabelText("Categoría"))).toEqual([
      "Sin categoría",
      "Matemáticas",
      "Física",
    ]);

    await user.selectOptions(screen.getByLabelText("Calendario"), "cal-b");

    expect(optionNames(screen.getByLabelText("Categoría"))).toEqual([
      "Sin categoría",
      "Cumpleaños",
    ]);
  });

  it("drops the chosen category when the calendar changes (RF-27)", async () => {
    const user = userEvent.setup();
    setup(undefined, { ...INITIAL, categoryId: "cat-1" });
    expect(screen.getByLabelText("Categoría")).toHaveValue("cat-1");

    await user.selectOptions(screen.getByLabelText("Calendario"), "cal-b");

    expect(screen.getByLabelText("Categoría")).toHaveValue("");
  });

  it("uses the calendar's color unless one is chosen (RF-17)", async () => {
    const user = userEvent.setup();
    setup();

    expect(
      screen.getByRole("radio", { name: "Color del calendario" }),
    ).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Lavanda" }));
    expect(screen.getByRole("radio", { name: "Lavanda" })).toBeChecked();
  });

  it("shows each error next to its field (RF-18, RF-19)", async () => {
    const user = userEvent.setup();
    setup(async () => ({
      fieldErrors: {
        title: "Escribe un título de 1 a 100 caracteres.",
        endTime: "El fin no puede ser anterior al inicio.",
      },
      values: INITIAL,
    }));

    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    await screen.findByText("Escribe un título de 1 a 100 caracteres.");
    expect(screen.getByLabelText("Título")).toHaveAccessibleDescription(
      "Escribe un título de 1 a 100 caracteres.",
    );
    expect(screen.getByLabelText("Hora de fin")).toHaveAccessibleDescription(
      "El fin no puede ser anterior al inicio.",
    );
    expect(screen.getByLabelText("Hora de inicio")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("keeps what was typed after an error", async () => {
    const user = userEvent.setup();
    setup(async () => ({
      formError: "No tienes permiso para hacer esto.",
      values: { ...INITIAL, title: "Examen", location: "Aula 3", allDay: "on" },
    }));

    await user.type(screen.getByLabelText("Título"), "Examen");
    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No tienes permiso",
    );
    expect(screen.getByLabelText("Título")).toHaveValue("Examen");
    expect(screen.getByLabelText("Lugar")).toHaveValue("Aula 3");
    expect(screen.getByLabelText("Todo el día")).toBeChecked();
  });

  it("disables the button while the action is pending", async () => {
    const user = userEvent.setup();
    let finish: (state: State) => void = () => {};
    setup(
      () =>
        new Promise<State>((resolve) => {
          finish = resolve;
        }),
    );

    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    expect(
      await screen.findByRole("button", { name: "Creando…" }),
    ).toBeDisabled();
    finish({ values: INITIAL });
  });

  it("sends every typed value", async () => {
    const user = userEvent.setup();
    const action = setup();

    await user.type(screen.getByLabelText("Título"), "Matemáticas");
    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-2");
    await user.type(screen.getByLabelText("Lugar"), "Aula 3");
    await user.click(screen.getByRole("radio", { name: "Menta" }));
    await user.click(screen.getByRole("button", { name: "Crear evento" }));

    const formData = action.mock.calls[0]![1];
    expect(Object.fromEntries(formData.entries())).toMatchObject({
      title: "Matemáticas",
      calendarId: "cal-a",
      startDate: "2026-11-02",
      startTime: "09:00",
      endDate: "2026-11-02",
      endTime: "10:00",
      location: "Aula 3",
      color: "#CAFFBF",
      categoryId: "cat-2",
    });
    expect(formData.get("allDay")).toBeNull();
  });
});
