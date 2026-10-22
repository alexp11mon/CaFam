import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";
import type { ForgotPasswordState } from "@/lib/account/form-state";

// Spec 006, T11: the forgot-password screen answers the same whatever the
// address is (RF-1) and says when a link has expired (RF-3).
const SENT =
  "Si la dirección existe, te hemos enviado un correo con el enlace.";
const EXPIRED = "El enlace no es válido o ha caducado. Pide uno nuevo.";

describe("ForgotPasswordForm (RF-1, RF-3)", () => {
  it("asks for the email and sends the link", async () => {
    const action = vi.fn(async (): Promise<ForgotPasswordState> => ({
      sent: true,
      values: { email: "" },
    }));
    render(<ForgotPasswordForm action={action} />);

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(
      screen.getByRole("button", { name: "Enviar enlace" }),
    );

    expect(await screen.findByText(SENT)).toBeInTheDocument();
  });

  it("explains an expired link when it comes back from the confirm route (RF-3)", () => {
    render(<ForgotPasswordForm action={vi.fn()} expired />);

    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
  });
});
