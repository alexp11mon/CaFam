import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmailForm } from "@/components/account/email-form";
import type { EmailChangeState } from "@/lib/account/form-state";

// Spec 006, T17: the email change in Ajustes (RF-6, RF-10).
describe("EmailForm (RF-6, RF-10)", () => {
  it("shows the current address and asks for the new one and the password (RF-6)", () => {
    render(
      <EmailForm
        action={vi.fn()}
        email="ana@example.com"
        pendingEmail={null}
      />,
    );

    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Nuevo email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña actual")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a change waiting for confirmation (RF-10)", () => {
    render(
      <EmailForm
        action={vi.fn()}
        email="ana@example.com"
        pendingEmail="ana.nueva@example.com"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cambio pendiente de confirmar: ana.nueva@example.com",
    );
  });

  it("shows the pending change right after asking for it (RF-10)", async () => {
    const action = vi.fn(async (): Promise<EmailChangeState> => ({
      values: { newEmail: "" },
      pendingEmail: "ana.nueva@example.com",
    }));
    render(
      <EmailForm action={action} email="ana@example.com" pendingEmail={null} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar email" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Cambio pendiente de confirmar: ana.nueva@example.com",
    );
  });
});
