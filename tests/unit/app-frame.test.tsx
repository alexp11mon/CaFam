import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFrame, FrameSkeleton } from "@/components/shell/app-frame";

// Spec 005, T5: the frame of every screen with a session carries the user's
// accent from the first HTML (RF-9; plan D3), with the rail and the bottom bar (T6).
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/calendar",
  useRouter: () => ({ push: vi.fn() }),
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

  it("shows the header on a phone and the bottom bar up to 1023 px (spec 025 RF-8)", () => {
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
    expect(bar).toHaveClass("lg:hidden");
    expect(bar).not.toHaveClass("max-tab:hidden");
    // The content keeps clear of both, with the safe areas of iOS.
    const content = document.querySelector("#contenido")!;
    expect(content.className).toContain(
      "pb-[calc(4rem+env(safe-area-inset-bottom))]",
    );
    expect(content.className).toContain(
      "pt-[calc(3.5rem+env(safe-area-inset-top))]",
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

// Spec 023, T12: keyboard users skip the navigation (RF-18, WCAG 2.4.1).
describe("AppFrame skip link", () => {
  it("is the first link and leads to the content", () => {
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

    const skip = screen.getAllByRole("link")[0];
    expect(skip).toHaveAccessibleName("Saltar al contenido");
    const target = document.querySelector(skip.getAttribute("href")!);
    expect(target).toContainElement(screen.getByText("Contenido"));
    expect(target).toHaveAttribute("tabindex", "-1");
  });
});
