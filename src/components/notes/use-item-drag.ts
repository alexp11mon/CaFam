"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

/** Holding the handle this long starts a drag with a finger (spec 048 RF-3). */
const HOLD_MS = 300;
/** A finger that moves more before that is scrolling. */
const SLOP_PX = 8;
/** Near the edge of the window the page scrolls by itself. */
const EDGE_PX = 64;

interface Press {
  id: string;
  y: number;
  active: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Drags the items of a list by their handle with Pointer Events: the mouse
 * at once, a finger after holding 300 ms (spec 048 RF-3). Rows carry
 * `data-item-id`; `onDrop(id, toIndex)` gets the index among the rows once
 * moved. `over` is the row the item lands before (or "end").
 */
export function useItemDrag(
  list: RefObject<HTMLElement | null>,
  onDrop: (id: string, toIndex: number) => void,
) {
  const press = useRef<Press | null>(null);
  const [drag, setDrag] = useState<{ id: string; over: string } | null>(null);

  const rows = (id: string) =>
    Array.from(
      list.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [],
    ).filter((row) => row.dataset.itemId !== id);

  // The rows above the pointer, without the dragged one.
  const indexAt = (id: string, y: number) =>
    rows(id).filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2 < y;
    }).length;

  // The row the item lands before, or "end".
  const target = (id: string, y: number) => ({
    id,
    over: rows(id)[indexAt(id, y)]?.dataset.itemId ?? "end",
  });

  function stop() {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
    setDrag(null);
  }

  function start(id: string, y: number) {
    if (!press.current) return;
    press.current.active = true;
    setDrag(target(id, y));
  }

  const handle = (id: string) => ({
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const y = event.clientY;
      press.current = { id, y, active: false };
      if (event.pointerType === "mouse") start(id, y);
      else press.current.timer = setTimeout(() => start(id, y), HOLD_MS);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const current = press.current;
      if (!current) return;
      const y = event.clientY;
      if (!current.active) {
        if (Math.abs(y - current.y) > SLOP_PX) stop();
        return;
      }
      // shortcut: one step per move, not a timed loop; enough for lists of 100.
      if (y < EDGE_PX) window.scrollBy?.(0, -16);
      else if (y > window.innerHeight - EDGE_PX) window.scrollBy?.(0, 16);
      setDrag(target(id, y));
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const current = press.current;
      if (current?.active) onDrop(id, indexAt(id, event.clientY));
      stop();
    },
    onPointerCancel: stop,
    // A long press would open the system menu on Android.
    onContextMenu: (event: ReactMouseEvent) => event.preventDefault(),
  });

  return { dragging: drag?.id ?? null, over: drag?.over ?? null, handle };
}
