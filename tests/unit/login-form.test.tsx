import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import type { FormAction, SignInState } from "@/lib/auth/form-state";

const search = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.query),
}));

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), "ana@example.com");
  await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    search.query = "";
  });

  it("shows the generic credentials error and keeps the email (RF-6)", async () => {
    const action = vi.fn<FormAction<SignInState>>(async () => ({
      formError: "Email o contraseña incorrectos.",
      values: { email: "ana@example.com" },
    }));
    render(<LoginForm action={action} />);

    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email o contraseña incorrectos.",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("disables the button while the action is pending", async () => {
    let finish: (state: SignInState) => void = () => {};
    const action = vi.fn<FormAction<SignInState>>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<LoginForm action={action} />);

    await fillAndSubmit();

    expect(
      await screen.findByRole("button", { name: "Entrando…" }),
    ).toBeDisabled();
    finish({ values: { email: "ana@example.com" } });
    expect(await screen.findByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("sends the email and password fields", async () => {
    const action = vi.fn<FormAction<SignInState>>(async () => ({
      values: { email: "" },
    }));
    render(<LoginForm action={action} />);

    await fillAndSubmit();

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("ana@example.com");
    expect(formData?.get("password")).toBe("incorrecta");
  });

  it("carries the next of the URL in a hidden field (RF-7)", () => {
    search.query =
      "next=%2Finvite%2FabcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";
    const action = vi.fn<FormAction<SignInState>>(async () => ({
      values: { email: "" },
    }));
    const { container } = render(<LoginForm action={action} />);

    expect(container.querySelector('input[name="next"]')).toHaveValue(
      "/invite/abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_",
    );
  });

  it("sends an empty next when the URL has none", () => {
    const action = vi.fn<FormAction<SignInState>>(async () => ({
      values: { email: "" },
    }));
    const { container } = render(<LoginForm action={action} />);

    expect(container.querySelector('input[name="next"]')).toHaveValue("");
  });
});
