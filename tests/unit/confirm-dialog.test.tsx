import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import type { ConfirmState } from "@/lib/forms/form-state";

// jsdom does not implement the modal methods of <dialog>.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

function renderDialog(action = vi.fn(async (): Promise<ConfirmState> => ({}))) {
  render(
    <ConfirmDialog
      triggerLabel="Borrar calendario"
      title="¿Borrar «Clases Uni»?"
      description="Se borrarán también todos sus eventos y categorías. No se puede deshacer."
      confirmLabel="Sí, borrar"
      action={action}
    />,
  );
  return action;
}

describe("ConfirmDialog (RF-6, RF-24)", () => {
  it("stays closed until the trigger is pressed", () => {
    renderDialog();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Borrar calendario" }),
    ).toBeVisible();
  });

  it("names the item and warns about the loss when opened", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Borrar calendario" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("¿Borrar «Clases Uni»?");
    expect(dialog).toHaveTextContent("Se borrarán también todos sus eventos");
  });

  it("does not run the action when cancelled", async () => {
    const user = userEvent.setup();
    const action = renderDialog();

    await user.click(screen.getByRole("button", { name: "Borrar calendario" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("runs the action when confirmed", async () => {
    const user = userEvent.setup();
    const action = renderDialog();

    await user.click(screen.getByRole("button", { name: "Borrar calendario" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the error returned by the action inside the dialog", async () => {
    const user = userEvent.setup();
    renderDialog(
      vi.fn(async (): Promise<ConfirmState> => ({
        formError: "Este elemento ya no existe.",
      })),
    );

    await user.click(screen.getByRole("button", { name: "Borrar calendario" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este elemento ya no existe.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
