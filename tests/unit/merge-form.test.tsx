import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  MergeForm,
  type MergeFormValues,
} from "@/components/calendar/merge-form";
import type { MergeField } from "@/lib/calendar/schemas";
import type { MergeMember } from "@/lib/sharing/merge-access";
import type { FormState } from "@/lib/forms/form-state";

type State = FormState<MergeField>;

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const CALENDARS = [
  { id: "a", name: "Clases Uni", color: "#A0C4FF", eventCount: 3 },
  { id: "b", name: "Examenes Uni", color: "#FFADAD", eventCount: 2 },
  { id: "c", name: "Familia", color: "#CAFFBF", eventCount: 1 },
];

const EMPTY: MergeFormValues = {
  sourceIds: "",
  targetId: "",
  newName: "",
  newColor: "#2563EB",
};

function setup(
  implementation?: (prev: State, formData: FormData) => Promise<State>,
  members: MergeMember[] = [],
) {
  const action = vi.fn<(prev: State, formData: FormData) => Promise<State>>(
    implementation ?? (async () => ({ values: EMPTY })),
  );
  render(
    <MergeForm
      action={action}
      calendars={CALENDARS}
      initial={EMPTY}
      members={members}
    />,
  );
  return action;
}

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  ...names: string[]
) {
  for (const name of names) {
    await user.click(screen.getByRole("checkbox", { name: new RegExp(name) }));
  }
}

describe("MergeForm (RF-49..RF-52)", () => {
  it("lists the calendars it receives with their number of events", () => {
    setup();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    expect(
      screen.getByRole("checkbox", { name: /Clases Uni/ }),
    ).toHaveAccessibleName(/3 eventos/);
    expect(
      screen.getByRole("checkbox", { name: /Familia/ }),
    ).toHaveAccessibleName(/1 evento\b/);
  });

  it("needs at least two calendars before it can continue", async () => {
    const user = userEvent.setup();
    setup();
    const button = screen.getByRole("button", { name: "Juntar calendarios" });
    expect(button).toBeDisabled();
    expect(
      screen.getByText("Elige al menos dos calendarios."),
    ).toBeInTheDocument();

    await choose(user, "Clases Uni");
    expect(button).toBeDisabled();

    await choose(user, "Examenes Uni");
    expect(button).toBeEnabled();
  });

  it("offers the chosen calendars or a new one as the result (RF-50)", async () => {
    const user = userEvent.setup();
    setup();
    await choose(user, "Clases Uni", "Examenes Uni");

    const result = screen.getByLabelText("Resultado");
    expect(
      within(result)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Un calendario nuevo", "Clases Uni", "Examenes Uni"]);
    expect(
      screen.getByLabelText("Nombre del calendario nuevo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Color" }),
    ).toBeInTheDocument();

    await user.selectOptions(result, "a");

    expect(
      screen.queryByLabelText("Nombre del calendario nuevo"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Color" }),
    ).not.toBeInTheDocument();
  });

  it("asks for confirmation listing what disappears and how many events move into a new calendar (RF-52)", async () => {
    const user = userEvent.setup();
    const action = setup();
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.type(
      screen.getByLabelText("Nombre del calendario nuevo"),
      "Universidad",
    );

    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("¿Juntar en «Universidad»?");
    expect(dialog).toHaveTextContent(
      "Desaparecerán: Clases Uni y Examenes Uni",
    );
    expect(dialog).toHaveTextContent("Se moverán 5 eventos");
    expect(dialog).toHaveTextContent("No se puede deshacer");
    expect(action).not.toHaveBeenCalled();
  });

  it("only counts the events of the calendars that disappear when merging into an existing one (RF-52)", async () => {
    const user = userEvent.setup();
    setup();
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.selectOptions(screen.getByLabelText("Resultado"), "a");

    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("¿Juntar en «Clases Uni»?");
    expect(dialog).toHaveTextContent("Desaparecerán: Examenes Uni");
    expect(dialog).not.toHaveTextContent("Desaparecerán: Clases Uni");
    expect(dialog).toHaveTextContent("Se moverán 2 eventos");
  });

  it("does not submit when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const action = setup();
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.type(
      screen.getByLabelText("Nombre del calendario nuevo"),
      "Uni",
    );

    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Cancelar",
      }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("submits the chosen calendars and the result once confirmed", async () => {
    const user = userEvent.setup();
    const action = setup();
    await choose(user, "Clases Uni", "Familia");
    await user.type(
      screen.getByLabelText("Nombre del calendario nuevo"),
      "Todo",
    );
    await user.click(screen.getByRole("radio", { name: "Lavanda" }));

    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sí, juntar",
      }),
    );

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0]![1];
    expect(formData.getAll("sourceIds")).toEqual(["a", "c"]);
    expect(formData.get("targetId")).toBe("");
    expect(formData.get("newName")).toBe("Todo");
    expect(formData.get("newColor")).toBe("#BDB2FF");
  });

  it("shows the permission error in Spanish and keeps the choice", async () => {
    const user = userEvent.setup();
    setup(async () => ({
      formError: "Solo puedes juntar calendarios de los que eres propietario.",
      values: { ...EMPTY, sourceIds: "a,b", newName: "Uni" },
    }));
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.type(
      screen.getByLabelText("Nombre del calendario nuevo"),
      "Uni",
    );
    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sí, juntar",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo puedes juntar calendarios de los que eres propietario.",
    );
    expect(screen.getByRole("checkbox", { name: /Clases Uni/ })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Examenes Uni/ }),
    ).toBeChecked();
    expect(screen.getByLabelText("Nombre del calendario nuevo")).toHaveValue(
      "Uni",
    );
  });

  it("shows field errors next to the field", async () => {
    const user = userEvent.setup();
    setup(async () => ({
      fieldErrors: { newName: "Escribe un nombre de 1 a 50 caracteres." },
      values: { ...EMPTY, sourceIds: "a,b" },
    }));
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Sí, juntar",
      }),
    );

    await screen.findByText("Escribe un nombre de 1 a 50 caracteres.");
    expect(
      screen.getByLabelText("Nombre del calendario nuevo"),
    ).toHaveAccessibleDescription("Escribe un nombre de 1 a 50 caracteres.");
  });
});

describe("MergeForm members notice (RF-36, RF-37)", () => {
  const member = (
    calendarId: string,
    userId: string,
    name: string,
    role: MergeMember["role"] = "viewer",
  ): MergeMember => ({ calendarId, userId, name, role });

  const MEMBERS = [
    member("a", "owner", "Marta", "owner"),
    member("b", "owner", "Marta", "owner"),
    member("a", "luis", "Luis", "editor"),
    member("b", "ana", "Ana"),
    member("c", "zoe", "Zoe"),
  ];

  async function openDialog(target: string) {
    const user = userEvent.setup();
    await choose(user, "Clases Uni", "Examenes Uni");
    await user.selectOptions(screen.getByLabelText("Resultado"), target);
    if (target === "") {
      await user.type(
        screen.getByLabelText("Nombre del calendario nuevo"),
        "Uni",
      );
    }
    await user.click(
      screen.getByRole("button", { name: "Juntar calendarios" }),
    );
    return screen.getByRole("dialog");
  }

  it("names who loses access and who starts seeing other events", async () => {
    setup(undefined, MEMBERS);

    const dialog = await openDialog("a");

    expect(dialog).toHaveTextContent("Perderán el acceso: Ana.");
    expect(dialog).toHaveTextContent(
      "Pasarán a ver los eventos de los otros calendarios: Luis.",
    );
    expect(dialog).not.toHaveTextContent("Marta");
    expect(dialog).not.toHaveTextContent("Zoe");
    expect(dialog).toHaveTextContent("No se puede deshacer");
  });

  it("with a new calendar nobody gains and every member loses access", async () => {
    setup(undefined, MEMBERS);

    const dialog = await openDialog("");

    expect(dialog).toHaveTextContent("Perderán el acceso: Ana y Luis.");
    expect(dialog).not.toHaveTextContent("Pasarán a ver");
  });

  it("says nothing when there are no other members", async () => {
    setup(undefined, [member("a", "owner", "Marta", "owner")]);

    const dialog = await openDialog("a");

    expect(dialog).not.toHaveTextContent("Perderán el acceso");
    expect(dialog).not.toHaveTextContent("Pasarán a ver");
    expect(dialog).toHaveTextContent("No se puede deshacer");
  });
});
