import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoneEvent } from "@/components/calendar/gone-event";
import { ToastProvider } from "@/components/ui/toast";

// Spec 008, T6: the window of a just deleted event closes and says so (RF-8, RF-32).
const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("GoneEvent", () => {
  it("goes back and announces the deletion", () => {
    render(
      <ToastProvider>
        <GoneEvent />
      </ToastProvider>,
    );

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Evento borrado");
  });
});
