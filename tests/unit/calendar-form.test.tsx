import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarForm } from "@/components/calendar/calendar-form";
import { ColorPicker } from "@/components/calendar/color-picker";
import { CALENDAR_COLORS } from "@/lib/calendar/palette";
import type { CalendarField } from "@/lib/calendar/schemas";
import type { FormState } from "@/lib/forms/form-state";

type State = FormState<CalendarField>;

const EMPTY: State["values"] = {
  name: "",
  description: "",
  color: "#2563EB",
};

function renderForm(
  action = vi.fn<(prev: State, formData: FormData) => Promise<State>>(
    async () => ({ values: EMPTY }),
  ),
) {
  render(
    <CalendarForm
      action={action}
      initial={EMPTY}
      submitLabel="Crear calendario"
      pendingLabel="Creando…"
    />,
  );
  return action;
}

describe("CalendarForm (RF-1, RF-2, RF-4)", () => {
  it("shows each error next to its field", async () => {
    const user = userEvent.setup();
    renderForm(
      vi.fn(async (): Promise<State> => ({
        fieldErrors: { name: "Escribe un nombre de 1 a 50 caracteres." },
        values: { ...EMPTY, name: "  " },
      })),
    );

    await user.click(screen.getByRole("button", { name: "Crear calendario" }));

    await screen.findByText("Escribe un nombre de 1 a 50 caracteres.");
    const name = screen.getByLabelText("Nombre");
    expect(name).toHaveAccessibleDescription(
      "Escribe un nombre de 1 a 50 caracteres.",
    );
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Descripción")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("keeps what the user typed after an error", async () => {
    const user = userEvent.setup();
    renderForm(
      vi.fn(async (): Promise<State> => ({
        formError:
          "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
        values: { name: "Uni", description: "Clases", color: "#A0C4FF" },
      })),
    );

    await user.click(screen.getByRole("button", { name: "Crear calendario" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se ha podido conectar",
    );
    expect(screen.getByLabelText("Nombre")).toHaveValue("Uni");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Clases");
    expect(screen.getByRole("radio", { name: "Azul cielo" })).toBeChecked();
  });

  it("disables the button while the action is pending", async () => {
    const user = userEvent.setup();
    let finish: (state: State) => void = () => {};
    renderForm(
      vi.fn(
        () =>
          new Promise<State>((resolve) => {
            finish = resolve;
          }),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Crear calendario" }));

    expect(
      await screen.findByRole("button", { name: "Creando…" }),
    ).toBeDisabled();
    finish({ values: EMPTY });
    expect(
      await screen.findByRole("button", { name: "Crear calendario" }),
    ).toBeEnabled();
  });

  it("sends the typed values and the chosen color", async () => {
    const user = userEvent.setup();
    const action = renderForm();

    await user.type(screen.getByLabelText("Nombre"), "Universidad");
    await user.click(screen.getByRole("radio", { name: "Lavanda" }));
    await user.click(screen.getByRole("button", { name: "Crear calendario" }));

    const formData = action.mock.calls[0]?.[1];
    expect(formData.get("name")).toBe("Universidad");
    expect(formData.get("color")).toBe("#BDB2FF");
  });

  it("offers a way back to the panel", () => {
    renderForm();

    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
  });
});

describe("ColorPicker (RF-2)", () => {
  it("is a labelled radiogroup with every palette color and the default checked", () => {
    render(<ColorPicker name="color" defaultValue="#FFD6A5" />);

    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(CALENDAR_COLORS.length);
    expect(screen.getByRole("radio", { name: "Melocotón" })).toBeChecked();
  });

  it("is usable with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ColorPicker name="color" defaultValue="#2563EB" />);

    screen.getByRole("radio", { name: "Azul marca" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Coral" })).toBeChecked();
  });

  it("shows its error linked to the group", () => {
    render(
      <ColorPicker
        name="color"
        defaultValue="#2563EB"
        error="Elige un color."
      />,
    );

    expect(screen.getByRole("radiogroup")).toHaveAccessibleDescription(
      "Elige un color.",
    );
  });
});
