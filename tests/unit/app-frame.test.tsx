import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";

// Spec 005, T5: the frame of every screen with a session carries the user's
// accent from the first HTML (RF-9; plan D3), with the rail and the bottom bar (T6).
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/calendar",
}));
describe("AppFrame (RF-9)", () => {
  it("wraps the page in the user's accent", () => {
    const { container } = render(
      <AppFrame
        accent="blue"
        theme="system"
        displayName="Ana López"
        signOutAction={vi.fn(async () => {})}
      >
        <p>Contenido</p>
      </AppFrame>,
    );

    expect(screen.getByText("Contenido")).toBeInTheDocument();
    const frame = container.querySelector('[data-accent="blue"]');
    expect(frame).toContainElement(screen.getByText("Contenido"));
    // One navigation per width: the rail from 1024 px, the bottom bar below (RF-16, RF-18).
    expect(
      screen.getAllByRole("navigation", { name: "Principal" }),
    ).toHaveLength(2);
  });

  it("shows the phone header and leaves the bottom bar to tablets (spec 016 RF-6, RF-7)", () => {
    render(
      <AppFrame
        accent="red"
        theme="system"
        displayName="Ana López"
        signOutAction={vi.fn(async () => {})}
      >
        <p>Contenido</p>
      </AppFrame>,
    );

    expect(screen.getByRole("banner")).toHaveClass("tab:hidden");
    const [, bar] = screen.getAllByRole("navigation", { name: "Principal" });
    expect(bar).toHaveClass("max-tab:hidden", "lg:hidden");
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
