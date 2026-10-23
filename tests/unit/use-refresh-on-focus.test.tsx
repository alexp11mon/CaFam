import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRefreshOnFocus } from "@/lib/hooks/use-refresh-on-focus";

// Spec 008, T21: fresh events when the app comes back after a while (RF-34).
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const LOADED_AT = Date.parse("2026-10-23T10:00:00Z");

function Calendar() {
  useRefreshOnFocus(LOADED_AT);
  return null;
}

function comeBack(at: string) {
  vi.setSystemTime(new Date(at));
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  router.refresh.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRefreshOnFocus", () => {
  it("does nothing within the first minute", () => {
    render(<Calendar />);

    comeBack("2026-10-23T10:01:00Z");

    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refreshes after more than 60 seconds", () => {
    render(<Calendar />);

    comeBack("2026-10-23T10:01:01Z");

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores the page going to the background", () => {
    render(<Calendar />);
    vi.setSystemTime(new Date("2026-10-23T11:00:00Z"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(router.refresh).not.toHaveBeenCalled();
  });
});
