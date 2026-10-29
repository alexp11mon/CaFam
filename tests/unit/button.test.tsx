import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

// Spec 011, T10: buttons answer the pointer with the press utility of
// globals.css (RF-16; plan micro, D13).
describe("press on buttons (RF-16)", () => {
  it.each(["primary", "secondary", "danger"] as const)(
    "Button %s",
    (variant) => {
      render(<Button variant={variant}>Guardar</Button>);
      expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass(
        "press",
      );
    },
  );

  it.each(["primary", "secondary"] as const)("LinkButton %s", (variant) => {
    render(
      <LinkButton href="/dashboard" variant={variant}>
        Volver
      </LinkButton>,
    );
    expect(screen.getByRole("link", { name: "Volver" })).toHaveClass("press");
  });
});
