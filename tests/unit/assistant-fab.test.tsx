import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantFab } from "@/components/shell/assistant-fab";

// Spec 015, T16: the round assistant button on every screen of the panel but
// its own (RF-1, RF-39, plan D18).
const navigation = vi.hoisted(() => ({ pathname: "/dashboard/calendar" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

describe("AssistantFab (RF-39)", () => {
  beforeEach(() => {
    navigation.pathname = "/dashboard/calendar";
  });

  it("links to the assistant with its name and icon", () => {
    render(<AssistantFab />);
    const link = screen.getByRole("link", { name: "Asistente" });
    expect(link).toHaveAttribute("href", "/dashboard/assistant");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("is on other screens too", () => {
    navigation.pathname = "/dashboard/settings";
    render(<AssistantFab />);
    expect(screen.getByRole("link", { name: "Asistente" })).toBeInTheDocument();
  });

  it("is not on the assistant screen", () => {
    navigation.pathname = "/dashboard/assistant";
    render(<AssistantFab />);
    expect(screen.queryByRole("link", { name: "Asistente" })).toBeNull();
  });

  it("sits above the bottom bar, in the corner that is its own (spec 025 plan D7)", () => {
    render(<AssistantFab />);
    const link = screen.getByRole("link", { name: "Asistente" });
    expect(link.className).toContain(
      "bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]",
    );
    expect(link).toHaveClass("lg:bottom-6");
  });
});
