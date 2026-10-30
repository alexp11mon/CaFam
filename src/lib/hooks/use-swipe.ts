"use client";

import { useRef, type PointerEvent } from "react";
import { swipeDirection } from "@/lib/calendar/swipe";

/**
 * Pointer handlers that call `onSwipe` when a finger slides sideways. Only
 * touch counts (the mouse drags to create, spec 008), and never while a window
 * is open (spec 016 RF-25..RF-28, plan D5).
 */
export function useSwipe({
  onSwipe,
  enabled = true,
}: {
  onSwipe: (direction: "next" | "previous") => void;
  enabled?: boolean;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown(event: PointerEvent) {
      start.current =
        event.pointerType === "touch"
          ? { x: event.clientX, y: event.clientY }
          : null;
    },
    onPointerUp(event: PointerEvent) {
      const from = start.current;
      start.current = null;
      if (!from || !enabled || document.querySelector("dialog[open]")) return;
      const direction = swipeDirection(
        event.clientX - from.x,
        event.clientY - from.y,
      );
      if (direction) onSwipe(direction);
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
