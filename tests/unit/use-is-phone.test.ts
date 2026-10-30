import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PHONE_QUERY, useIsPhone } from "@/lib/hooks/use-is-phone";

// Spec 016 plan D1: the phone layout is 768 px or less.
let listeners: (() => void)[] = [];
let matches = false;

function mockMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === PHONE_QUERY && matches;
    },
    media: query,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: () => void) => {
      listeners = listeners.filter((item) => item !== cb);
    },
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  listeners = [];
  matches = false;
});

describe("useIsPhone", () => {
  it("asks for 768 px or less", () => {
    expect(PHONE_QUERY).toBe("(width <= 768px)");
  });

  it("follows the media query when the width changes", () => {
    mockMedia();
    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((cb) => cb());
    });

    expect(result.current).toBe(true);
  });
});
