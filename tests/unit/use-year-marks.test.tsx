import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useYearMarks } from "@/lib/hooks/use-year-marks";

// Spec 042 T4: the year's marks are kept and the next year read in idle time (RF-4, RNF-1).
afterEach(() => vi.useRealTimers());

describe("useYearMarks", () => {
  it("reads the year, then the next one when idle, and keeps both", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const load = vi.fn(async (year: number) => ({
      marks: { [`${year}-01-01`]: ["a"] },
    }));
    const { result, rerender } = renderHook(
      ({ year }) => useYearMarks(year, load),
      { initialProps: { year: 2026 } },
    );
    await waitFor(() =>
      expect(result.current.marks).toEqual({ "2026-01-01": ["a"] }),
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(load).toHaveBeenCalledWith(2027));

    // Moving on paints at once, without asking again.
    rerender({ year: 2027 });
    expect(result.current.marks).toEqual({ "2027-01-01": ["a"] });
    rerender({ year: 2026 });
    expect(result.current.marks).toEqual({ "2026-01-01": ["a"] });
    expect(load.mock.calls.filter(([y]) => y === 2026)).toHaveLength(1);
  });

  it("says when the year failed and reads it again on retry", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("red"))
      .mockResolvedValue({ marks: {} });
    const { result } = renderHook(() => useYearMarks(2026, load));
    await waitFor(() => expect(result.current.failed).toBe(true));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.marks).toEqual({}));
    expect(result.current.failed).toBe(false);
  });

  it("does nothing without a loader", () => {
    const { result } = renderHook(() => useYearMarks(2026, undefined));
    expect(result.current).toMatchObject({ marks: undefined, failed: false });
  });
});
