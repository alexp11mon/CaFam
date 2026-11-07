import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrossfadeText } from "@/components/ui/crossfade-text";

// Spec 021, T9: the old text fades out while the new one fades in (RF-52).
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("CrossfadeText", () => {
  it("keeps the old text in a leaving layer until it fades", () => {
    const { rerender } = render(<CrossfadeText text="noviembre" />);
    expect(screen.getByText("noviembre")).not.toHaveAttribute("data-leaving");

    rerender(<CrossfadeText text="diciembre" />);
    expect(screen.getByText("noviembre")).toHaveAttribute("data-leaving");
    expect(screen.getByText("noviembre")).toHaveAttribute("aria-hidden");
    expect(screen.getByText("diciembre")).toHaveAttribute("data-fresh");

    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("noviembre")).toBeNull();
  });
});
