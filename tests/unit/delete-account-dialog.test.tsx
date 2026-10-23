import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import type { ConfirmState } from "@/lib/forms/form-state";

// Spec 006, T17: deleting the account needs a clear warning, the email and the
// password (RF-16, RF-17).
beforeAll(() => {
  // jsdom has no showModal; the tests only need the open attribute.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

async function openDialog(
  action = vi.fn(async (): Promise<ConfirmState> => ({})),
) {
  render(<DeleteAccountDialog action={action} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Borrar mi cuenta" }),
  );
  return action;
}

describe("DeleteAccountDialog (RF-16, RF-17)", () => {
  it("warns that it cannot be undone (RF-16)", async () => {
    await openDialog();

    expect(screen.getByText(/no se puede deshacer/i)).toBeInTheDocument();
  });

  it("does not let confirm until both the email and the password are written (RF-17)", async () => {
    await openDialog();
    const confirm = screen.getByRole("button", {
      name: "Borrar definitivamente",
    });

    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tu email"), "ana@example.com");
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tu contraseña"), "actual-1234");
    expect(confirm).toBeEnabled();
  });

  it("shows the error of the action inside the dialog", async () => {
    await openDialog(
      vi.fn(async (): Promise<ConfirmState> => ({
        formError: "El email o la contraseña no coinciden.",
      })),
    );
    await userEvent.type(screen.getByLabelText("Tu email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Tu contraseña"), "mala-1234");

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar definitivamente" }),
    );

    expect(
      await screen.findByText("El email o la contraseña no coinciden."),
    ).toBeInTheDocument();
  });
});
