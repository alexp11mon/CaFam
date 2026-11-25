import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppBadge } from "@/lib/hooks/use-app-badge";

afterEach(() => {
  Reflect.deleteProperty(navigator, "setAppBadge");
  Reflect.deleteProperty(navigator, "clearAppBadge");
  vi.useRealTimers();
});

function stubBadging() {
  const setAppBadge = vi.fn(async () => undefined);
  const clearAppBadge = vi.fn(async () => undefined);
  Object.assign(navigator, { setAppBadge, clearAppBadge });
  return { setAppBadge, clearAppBadge };
}

describe("useAppBadge (spec 047 RF-12)", () => {
  it("shows the count of today", async () => {
    const api = stubBadging();
    renderHook(() => useAppBadge(async () => ({ enabled: true, count: 3 })));
    await waitFor(() => expect(api.setAppBadge).toHaveBeenCalledWith(3));
  });

  it("clears it with none left or when turned off", async () => {
    const api = stubBadging();
    renderHook(() => useAppBadge(async () => ({ enabled: true, count: 0 })));
    await waitFor(() => expect(api.clearAppBadge).toHaveBeenCalledTimes(1));
    renderHook(() => useAppBadge(async () => ({ enabled: false, count: 4 })));
    await waitFor(() => expect(api.clearAppBadge).toHaveBeenCalledTimes(2));
    expect(api.setAppBadge).not.toHaveBeenCalled();
  });

  it("reads again every 5 minutes", async () => {
    vi.useFakeTimers();
    stubBadging();
    const load = vi.fn(async () => ({ enabled: true, count: 1 }));
    renderHook(() => useAppBadge(load));
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does nothing without the Badging API", () => {
    const load = vi.fn(async () => ({ enabled: true, count: 1 }));
    renderHook(() => useAppBadge(load));
    expect(load).not.toHaveBeenCalled();
  });
});
