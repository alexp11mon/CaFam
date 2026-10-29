import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getRouteAccess } from "@/lib/auth/route-access";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/components/pwa/ios-install-hint", () => ({
  IosInstallHint: () => null,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: null }) },
  }),
}));

const { default: PrivacyPage } = await import("@/app/privacy/page");
const { default: HomePage } = await import("@/app/page");

// Spec 009, T12: the public privacy policy (RF-39, RF-40).
describe("/privacy (RF-39)", () => {
  it("opens without a session", () => {
    expect(getRouteAccess("/privacy", false)).toEqual({ type: "allow" });
    expect(getRouteAccess("/privacy", true)).toEqual({ type: "allow" });
  });

  it("explains in Spanish what is read and written, why, where, with whom and how to withdraw it", () => {
    render(<PrivacyPage />);

    for (const heading of [
      "Qué datos de Google lee CaFam",
      "Qué escribe CaFam en Google",
      "Para qué se usan",
      "Dónde se guardan",
      "Con quién se comparten",
      "Cómo retirar el permiso y borrar los datos",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(/requisitos de uso limitado/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Terceros con acceso a tu cuenta" }),
    ).toHaveAttribute("href", "https://myaccount.google.com/connections");
  });
});

describe("home page (RF-40)", () => {
  it("links the privacy policy", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("link", { name: "Política de privacidad" }),
    ).toHaveAttribute("href", "/privacy");
  });
});
