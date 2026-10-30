import { renderHook } from "@testing-library/react";
import type { PointerEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSwipe } from "@/lib/hooks/use-swipe";

// Spec 016, T6: sliding a finger changes the period (RF-25..RF-28, plan D5).
const at = (x: number, y: number, pointerType = "touch") =>
  ({ clientX: x, clientY: y, pointerType }) as PointerEvent;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSwipe", () => {
  it("reports next on a slide to the left and previous on one to the right", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipe }));

    result.current.onPointerDown(at(300, 100));
    result.current.onPointerUp(at(100, 110));
    result.current.onPointerDown(at(100, 100));
    result.current.onPointerUp(at(300, 90));

    expect(onSwipe.mock.calls).toEqual([["next"], ["previous"]]);
  });

  it("ignores the mouse, short or vertical slides, and a cancelled touch", () => {
    const onSwipe = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipe }));

    result.current.onPointerDown(at(300, 100, "mouse"));
    result.current.onPointerUp(at(100, 100, "mouse"));
    result.current.onPointerDown(at(300, 100));
    result.current.onPointerUp(at(270, 100));
    result.current.onPointerDown(at(300, 100));
    result.current.onPointerUp(at(200, 400));
    result.current.onPointerDown(at(300, 100));
    result.current.onPointerCancel();
    result.current.onPointerUp(at(100, 100));

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("does nothing while disabled or with a window open", () => {
    const onSwipe = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useSwipe({ onSwipe, enabled }),
      { initialProps: { enabled: false } },
    );
    result.current.onPointerDown(at(300, 100));
    result.current.onPointerUp(at(100, 100));

    rerender({ enabled: true });
    document.body.innerHTML = "<dialog open></dialog>";
    result.current.onPointerDown(at(300, 100));
    result.current.onPointerUp(at(100, 100));

    expect(onSwipe).not.toHaveBeenCalled();
  });
});
