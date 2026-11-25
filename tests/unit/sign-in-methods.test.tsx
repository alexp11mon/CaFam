import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SignInMethods } from "@/components/account/sign-in-methods";
import { signInMethods } from "@/lib/account/sign-in-methods";

// Spec 050, T3: "Formas de entrar" (RF-5, RF-6).
const props = {
  linkAction: vi.fn(async () => {}),
  unlinkAction: vi.fn(async () => ({})),
  createPasswordAction: vi.fn(async () => ({ saved: "Contraseña creada." })),
};

describe("SignInMethods", () => {
  it("offers to link Google to an email account", () => {
    render(<SignInMethods {...props} hasPassword googleEmail={null} />);
    expect(screen.getByText("Email y contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conectar Google" }),
    ).toBeInTheDocument();
  });

  it("shows the Google address masked and unlinks it while a password remains", () => {
    render(
      <SignInMethods {...props} hasPassword googleEmail="ana@gmail.com" />,
    );
    expect(screen.getByText("Google (a***@gmail.com)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desconectar Google" }),
    ).toBeInTheDocument();
  });

  it("an account with only Google creates a password, without the current one", async () => {
    render(
      <SignInMethods
        {...props}
        hasPassword={false}
        googleEmail="ana@gmail.com"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Desconectar Google" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/actual/i)).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText("Nueva contraseña"),
      "nueva-1234",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Crear contraseña" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Contraseña creada.",
    );
  });
});

describe("signInMethods", () => {
  const user = (identities: unknown[], metadata = {}) =>
    ({ identities, user_metadata: metadata }) as unknown as User;

  it("reads the identities and the password made later", () => {
    expect(signInMethods(user([{ provider: "email" }]))).toEqual({
      hasPassword: true,
      google: null,
    });
    const google = {
      provider: "google",
      identity_data: { email: "ana@gmail.com" },
    };
    expect(signInMethods(user([google]))).toEqual({
      hasPassword: false,
      google: { email: "ana@gmail.com" },
    });
    expect(
      signInMethods(user([google], { has_password: true })).hasPassword,
    ).toBe(true);
    expect(signInMethods(null)).toEqual({ hasPassword: false, google: null });
  });
});
