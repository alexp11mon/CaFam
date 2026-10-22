import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";

// Spec 005, T5: the frame of every screen with a session carries the user's
// accent from the first HTML (RF-9; plan D3).
describe("AppFrame (RF-9)", () => {
  it("wraps the page in the user's accent", () => {
    const { container } = render(
      <AppFrame accent="blue">
        <p>Contenido</p>
      </AppFrame>,
    );

    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(container.querySelector('[data-accent="blue"]')).toContainElement(
      screen.getByText("Contenido"),
    );
  });
});

describe("FrameSkeleton (RF-9)", () => {
  it("shows that it is loading without painting any accent", () => {
    const { container } = render(<FrameSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
    expect(container.querySelector("[data-accent]")).toBeNull();
    expect(container.innerHTML).not.toMatch(/accent/);
  });
});
