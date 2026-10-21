import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "@/components/auth/auth-card";

const search = vi.hoisted(() => ({ query: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.query),
}));

const footer = {
  text: "¿No tienes cuenta?",
  linkLabel: "Crea una",
  href: "/signup",
};

describe("AuthCard footer link (RF-7)", () => {
  beforeEach(() => {
    search.query = "";
  });

  it("links to the other form as is without next", () => {
    render(
      <AuthCard title="Entrar" footer={footer}>
        <p>formulario</p>
      </AuthCard>,
    );
    expect(screen.getByRole("link", { name: "Crea una" })).toHaveAttribute(
      "href",
      "/signup",
    );
  });

  it("keeps next when linking login and signup", () => {
    search.query = "next=%2Finvite%2Fabc";
    render(
      <AuthCard title="Entrar" footer={footer}>
        <p>formulario</p>
      </AuthCard>,
    );
    expect(screen.getByRole("link", { name: "Crea una" })).toHaveAttribute(
      "href",
      "/signup?next=%2Finvite%2Fabc",
    );
  });
});
