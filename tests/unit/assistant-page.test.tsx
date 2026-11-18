import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Spec 037 RF-4: the page fits under the top bar, so the input bar and
// "Enviar" are on screen at every width (the old `lg:h-dvh` came from the
// sidebar frame of spec 025 and overflowed it by the top bar of spec 030).
vi.mock("@/components/assistant/assistant-chat", () => ({
  AssistantChat: () => <p>Chat</p>,
}));
vi.mock("@/app/dashboard/assistant/context-actions", () => ({
  loadAssistantContext: vi.fn(),
}));

const { default: AssistantPage } =
  await import("@/app/dashboard/assistant/page");

describe("the assistant's page", () => {
  it("leaves room for the top bar from 769 px, also on wide screens", () => {
    render(<AssistantPage />);
    const main = screen.getByRole("main");
    expect(main.className).toContain(
      "tab:h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]",
    );
    expect(main.className).not.toMatch(/\blg:h-dvh\b/);
  });
});
