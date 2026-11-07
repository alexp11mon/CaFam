import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SwapLabel } from "@/components/ui/swap-label";

// Spec 021, T8: a pending label that keeps the button's size (RF-52, RF-53).
describe("SwapLabel", () => {
  it("keeps both texts in one cell, the hidden one aria-hidden", () => {
    render(
      <button type="button">
        <SwapLabel busy={false} idle="Guardar" busyText="Guardando…" />
      </button>,
    );
    const cell = screen.getByText("Guardar").parentElement!;
    expect(cell).toHaveClass("swap");
    expect(cell.children).toHaveLength(2);
    expect(screen.getByText("Guardando…")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByText("Guardando…")).toHaveAttribute("data-off");
    expect(screen.getByRole("button")).toHaveAccessibleName("Guardar");
  });

  it("names the button with the busy text while busy", () => {
    render(
      <button type="button">
        <SwapLabel busy idle="Guardar" busyText="Guardando…" />
      </button>,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Guardando…");
    expect(screen.getByText("Guardar")).toHaveAttribute("data-off");
  });
});
