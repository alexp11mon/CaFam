"use client";

import { useRef, type PointerEvent, type RefObject } from "react";
import { lockAxis, trackVelocity } from "@/lib/motion/release";

type Gesture = {
  id: number;
  x: number;
  y: number;
  axis: "x" | "y" | null;
  delta: number;
  velocity: ReturnType<typeof trackVelocity>;
};

/**
 * Something that follows a finger sideways (spec 021 RF-23, RF-26, RF-27,
 * plan follow-gesture, D11): the axis is picked at 10 px, and a vertical
 * gesture is left to the page. While it moves, `translate` is written in the
 * next frame, with no React state per frame. The release hands the distance
 * and the speed to `onRelease`, which animates what is left (RF-24). Only a
 * finger counts (the mouse drags to create), never under another window, and
 * a second finger cancels it.
 */
export function useFollowDrag<T extends HTMLElement>(
  ref: RefObject<T | null>,
  {
    onRelease,
    offset = (delta) => delta,
    enabled = true,
  }: {
    onRelease: (delta: number, velocity: number, el: T) => void;
    /** Where the element goes for the finger's `delta`: the rubber band past a limit. */
    offset?: (delta: number) => number;
    enabled?: boolean;
  },
) {
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);

  function write(value: string) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (ref.current) ref.current.style.translate = value;
    });
  }

  function cancel() {
    if (gesture.current?.axis === "x") write("");
    gesture.current = null;
  }

  /** Follows the finger to `x, y`; false once the gesture is not ours. */
  function follow(event: PointerEvent, now: number): boolean {
    const current = gesture.current;
    if (!current || event.pointerId !== current.id) return false;
    if (!enabled) {
      cancel();
      return false;
    }
    const dx = event.clientX - current.x;
    current.axis ??= lockAxis(dx, event.clientY - current.y);
    if (current.axis !== "x") {
      if (current.axis === "y") gesture.current = null;
      return false;
    }
    current.delta = dx;
    current.velocity.add(dx, now);
    return true;
  }

  return {
    onPointerDown(event: PointerEvent) {
      if (gesture.current) {
        // A second finger: a pinch, not a slide.
        cancel();
        return;
      }
      if (event.pointerType !== "touch" || !enabled) return;
      const own = ref.current?.closest("dialog");
      const other = [...document.querySelectorAll("dialog[open]")].some(
        (dialog) => dialog !== own,
      );
      if (other) return;
      // Speed comes from the moves only: a lone press and release is no flick.
      const velocity = trackVelocity();
      gesture.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        axis: null,
        delta: 0,
        velocity,
      };
    },
    onPointerMove(event: PointerEvent) {
      if (!follow(event, event.timeStamp)) return;
      write(`${offset(gesture.current!.delta)}px 0px`);
    },
    onPointerUp(event: PointerEvent) {
      if (!follow(event, event.timeStamp)) {
        gesture.current = null;
        return;
      }
      const { delta, velocity } = gesture.current!;
      gesture.current = null;
      cancelAnimationFrame(frame.current);
      const el = ref.current;
      if (!el) return;
      // The last frame, so the release animates from exactly here.
      el.style.translate = `${offset(delta)}px 0px`;
      onRelease(delta, velocity.velocity(), el);
    },
    onPointerCancel() {
      cancel();
    },
  };
}
