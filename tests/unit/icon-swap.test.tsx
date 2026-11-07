import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IconSwap } from "@/components/ui/icon-swap";

// Spec 021, T9: one icon blurs out while the other blurs in (RF-54).
describe("IconSwap", () => {
  it("stacks both icons and lets only the shown one be read", () => {
    render(
      <IconSwap
        show="b"
        a={<span role="img" aria-label="Luna" />}
        b={<span role="img" aria-label="Sol" />}
      />,
    );
    expect(screen.getByRole("img", { name: "Sol" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Luna" })).toBeNull();
    const luna = screen.getByRole("img", { name: "Luna", hidden: true });
    expect(luna.parentElement).toHaveAttribute("data-off");
    expect(luna.parentElement!.parentElement).toHaveClass("swap");
    expect(luna.parentElement!.parentElement).toHaveAttribute("data-icons");
  });
});
