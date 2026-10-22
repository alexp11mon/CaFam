import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Spec 006, T11: the login screen links to the password recovery (RF-1).
vi.mock("@/app/(auth)/actions", () => ({ signIn: vi.fn(), signUp: vi.fn() }));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

describe("login links to password recovery (RF-1)", () => {
  it("shows the recovery link pointing to /forgot-password", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", {
      name: "¿Olvidaste tu contraseña?",
    });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });
});
