import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "@/lib/hooks/use-presence";

// Spec 021, T3: what closes stays until its exit ends (RF-9, RF-65).
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePresence", () => {
  it("keeps a closed element mounted and leaving until the exit ends", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence(open, 160),
      { initialProps: { open: true } },
    );
    expect(result.current).toEqual({ mounted: true, leaving: false });

    rerender({ open: false });
    expect(result.current).toEqual({ mounted: true, leaving: true });

    act(() => vi.advanceTimersByTime(160));
    expect(result.current).toEqual({ mounted: false, leaving: false });
  });

  it("cancels the exit when it opens again", () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePresence(open, 160),
      { initialProps: { open: true } },
    );
    rerender({ open: false });
    act(() => vi.advanceTimersByTime(80));
    rerender({ open: true });
    act(() => vi.advanceTimersByTime(200));

    expect(result.current).toEqual({ mounted: true, leaving: false });
  });

  it("starts unmounted when closed", () => {
    const { result } = renderHook(() => usePresence(false, 160));
    expect(result.current).toEqual({ mounted: false, leaving: false });
  });
});
