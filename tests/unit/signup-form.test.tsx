import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "@/components/auth/signup-form";
import type { FormAction, SignUpState } from "@/lib/auth/form-state";

afterEach(() => {
  vi.restoreAllMocks();
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre visible"), "Ana");
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "12345678");
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("SignupForm", () => {
  it("shows each error next to its field (RF-3)", async () => {
    const action = vi.fn(async (): Promise<SignUpState> => ({
      fieldErrors: {
        email: "Introduce un email válido.",
        password: "La contraseña debe tener al menos 8 caracteres.",
      },
      values: { displayName: "Ana", email: "ana@" },
    }));
    render(<SignupForm action={action} />);

    await fillAndSubmit();

    const email = await screen.findByLabelText("Email");
    expect(email).toHaveAccessibleDescription("Introduce un email válido.");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription(
      "La contraseña debe tener al menos 8 caracteres.",
    );
    expect(screen.getByLabelText("Nombre visible")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("disables the button while the action is pending", async () => {
    let finish: (state: SignUpState) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<SignUpState>((resolve) => {
          finish = resolve;
        }),
    );
    render(<SignupForm action={action} />);

    await fillAndSubmit();

    expect(
      await screen.findByRole("button", { name: "Creando cuenta…" }),
    ).toBeDisabled();
    finish({ values: { displayName: "Ana", email: "ana@example.com" } });
    expect(
      await screen.findByRole("button", { name: "Crear cuenta" }),
    ).toBeEnabled();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("keeps the name and email after a form error (RF-2, RF-12)", async () => {
    const action = vi.fn(async (): Promise<SignUpState> => ({
      formError: "Ya existe una cuenta con este email.",
      values: { displayName: "Ana", email: "ana@example.com" },
    }));
    render(<SignupForm action={action} />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ya existe una cuenta con este email.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Nombre visible")).toHaveValue("Ana");
  });

  it("sends the browser time zone in a hidden field (RF-26)", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "America/Bogota",
    } as Intl.ResolvedDateTimeFormatOptions);
    const action = vi.fn<FormAction<SignUpState>>(async () => ({
      values: { displayName: "", email: "" },
    }));
    render(<SignupForm action={action} />);

    await fillAndSubmit();

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[1].get("timeZone")).toBe("America/Bogota");
  });
});
