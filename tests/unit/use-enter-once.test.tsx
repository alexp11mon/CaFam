import { act, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEnterOnce } from "@/lib/hooks/use-enter-once";

// Spec 021, T3: a list staggers when it mounts, never again when Activity
// shows it again (RF-16..RF-18, plan D7).
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function List() {
  const entering = useEnterOnce();
  return <ul aria-label="Lista" data-entering={entering || undefined} />;
}

describe("useEnterOnce", () => {
  it("marks the list while it enters and drops the mark at 400 ms", () => {
    render(<List />);
    expect(screen.getByRole("list")).toHaveAttribute("data-entering");

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole("list")).not.toHaveAttribute("data-entering");
  });

  it("does not mark it again when hidden and shown", () => {
    const { rerender } = render(
      <Activity mode="visible">
        <List />
      </Activity>,
    );
    act(() => vi.advanceTimersByTime(400));
    rerender(
      <Activity mode="hidden">
        <List />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <List />
      </Activity>,
    );

    expect(screen.getByRole("list")).not.toHaveAttribute("data-entering");
  });
});
