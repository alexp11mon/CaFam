import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CategoryManager } from "@/components/calendar/category-manager";
import type { ConfirmState, FormState } from "@/lib/forms/form-state";

type State = FormState<"name">;

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

const CATEGORIES = [
  { id: "c1", name: "Clases de la UNI" },
  { id: "c2", name: "Exámenes" },
];

function setup(
  overrides: Partial<React.ComponentProps<typeof CategoryManager>> = {},
) {
  const create = vi.fn<(prev: State, formData: FormData) => Promise<State>>(
    async () => ({ values: { name: "" } }),
  );
  const rename = vi.fn<
    (id: string, prev: State, formData: FormData) => Promise<State>
  >(async (_id, _prev, formData) => ({
    values: { name: String(formData.get("name")) },
  }));
  const remove = vi.fn<(id: string) => Promise<ConfirmState>>(async () => ({}));
  render(
    <CategoryManager
      categories={CATEGORIES}
      canEdit
      createAction={create}
      renameAction={rename}
      deleteAction={remove}
      {...overrides}
    />,
  );
  return { create, rename, remove };
}

describe("CategoryManager (RF-9..RF-14)", () => {
  it("lists the categories of the calendar (RF-13)", () => {
    setup();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Clases de la UNI");
    expect(items[1]).toHaveTextContent("Exámenes");
  });

  it("says so when there are no categories", () => {
    setup({ categories: [] });

    expect(
      screen.getByText("Este calendario aún no tiene categorías."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("creates a category with the typed name (RF-9)", async () => {
    const user = userEvent.setup();
    const { create } = setup();

    await user.type(screen.getByLabelText("Nueva categoría"), "Familia");
    await user.click(screen.getByRole("button", { name: "Añadir categoría" }));

    expect(create).toHaveBeenCalledTimes(1);
    const formData = create.mock.calls[0]![1];
    expect(formData.get("name")).toBe("Familia");
  });

  it("shows a duplicate-name error next to the field (RF-10)", async () => {
    const user = userEvent.setup();
    setup({
      createAction: async () => ({
        fieldErrors: { name: "Ya existe una categoría con ese nombre." },
        values: { name: "exámenes" },
      }),
    });

    await user.type(screen.getByLabelText("Nueva categoría"), "exámenes");
    await user.click(screen.getByRole("button", { name: "Añadir categoría" }));

    const field = await screen.findByLabelText("Nueva categoría");
    expect(field).toHaveAccessibleDescription(
      "Ya existe una categoría con ese nombre.",
    );
    expect(field).toHaveValue("exámenes");
  });

  it("renames a category (RF-11)", async () => {
    const user = userEvent.setup();
    const { rename } = setup();

    await user.click(
      screen.getByRole("button", { name: "Renombrar Clases de la UNI" }),
    );
    const field = screen.getByLabelText("Nuevo nombre de «Clases de la UNI»");
    await user.clear(field);
    await user.type(field, "Universidad");
    await user.click(screen.getByRole("button", { name: "Guardar nombre" }));

    expect(rename).toHaveBeenCalledTimes(1);
    expect(rename.mock.calls[0]![0]).toBe("c1");
    expect(rename.mock.calls[0]![2].get("name")).toBe("Universidad");
  });

  it("asks for confirmation before deleting and then deletes (RF-11, RF-12)", async () => {
    const user = userEvent.setup();
    const { remove } = setup();

    await user.click(screen.getByRole("button", { name: "Borrar Exámenes" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("¿Borrar la categoría «Exámenes»?");
    expect(dialog).toHaveTextContent("quedarán «Sin categoría»");
    expect(remove).not.toHaveBeenCalled();

    await user.click(
      within(dialog).getByRole("button", { name: "Sí, borrar" }),
    );

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]![0]).toBe("c2");
  });

  it("gives viewers a read-only list without controls (RF-14)", () => {
    setup({ canEdit: false });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
