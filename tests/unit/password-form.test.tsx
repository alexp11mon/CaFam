import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordForm } from "@/components/account/password-form";
import type { PasswordChangeState } from "@/lib/account/form-state";

// Spec 006, T16: changing the password in Ajustes (RF-30 to RF-33).
describe("PasswordForm (RF-30 to RF-32)", () => {
  it("asks for the current and the new password", () => {
    render(<PasswordForm action={vi.fn()} />);

    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("Nueva contraseña")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("shows when the new password is the same as the current one (RF-32)", async () => {
    const action = vi.fn(async (): Promise<PasswordChangeState> => ({
      fieldErrors: {
        newPassword: "La contraseña nueva no puede ser igual a la actual.",
      },
    }));
    render(<PasswordForm action={action} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    const message = await screen.findByText(
      "La contraseña nueva no puede ser igual a la actual.",
    );
    expect(screen.getByLabelText("Nueva contraseña")).toHaveAttribute(
      "aria-describedby",
      message.id,
    );
  });

  it("confirms the change and that the other sessions were closed (RF-33)", async () => {
    const action = vi.fn(async (): Promise<PasswordChangeState> => ({
      saved: true,
    }));
    render(<PasswordForm action={action} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Contraseña cambiada. Se han cerrado tus otras sesiones.",
    );
  });

  it("disables the button while saving", async () => {
    const action = vi.fn(() => new Promise<PasswordChangeState>(() => {}));
    render(<PasswordForm action={action} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    expect(
      await screen.findByRole("button", { name: "Guardando…" }),
    ).toBeDisabled();
  });
});
