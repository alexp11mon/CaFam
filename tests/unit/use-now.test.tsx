import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "@/lib/hooks/use-now";

// Spec 005, T4: the clock behind the now line and the countdown
// (RF-39, RF-47, RF-48; plan D13).
function Clock() {
  const now = useNow();
  return <p>{now === null ? "sin hora" : new Date(now).toISOString()}</p>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("gives the current time on the client", () => {
    render(<Clock />);

    expect(screen.getByText("2026-11-02T10:00:00.000Z")).toBeInTheDocument();
  });

  it("ticks every 30 seconds (RF-47)", () => {
    render(<Clock />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText("2026-11-02T10:00:30.000Z")).toBeInTheDocument();
  });

  it("catches up when the page comes back to the foreground (casos límite)", () => {
    render(<Clock />);

    act(() => {
      // A suspended device fires no timers: the clock jumps on return.
      vi.setSystemTime(new Date("2026-11-02T14:00:05Z"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("2026-11-02T14:00:05.000Z")).toBeInTheDocument();
  });

  it("shares one time between components", () => {
    render(
      <>
        <Clock />
        <Clock />
      </>,
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getAllByText("2026-11-02T10:00:30.000Z")).toHaveLength(2);
  });
});
