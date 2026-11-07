"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A ring that slides from the chosen card to the next one instead of jumping
 * (spec 021 RF-62). It sits over the card that holds the checked radio of its
 * group, measured on each choice and resize. Purely decorative.
 */
export function SelectionRing({ selected }: { selected: string }) {
  const ring = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ring.current;
    const group = element?.parentElement;
    if (!element || !group) return;
    const place = () => {
      const chosen = group.querySelector("label:has(input:checked)");
      if (!chosen) return;
      const outer = group.getBoundingClientRect();
      const inner = chosen.getBoundingClientRect();
      element.style.translate = `${inner.left - outer.left}px ${inner.top - outer.top}px`;
      element.style.width = `${inner.width}px`;
      element.style.height = `${inner.height}px`;
      element.dataset.ready = "";
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => observer.disconnect();
  }, [selected]);

  return (
    <span
      ref={ring}
      aria-hidden="true"
      data-selection-ring=""
      className="pointer-events-none absolute top-0 left-0 hidden rounded-2xl ring-1 ring-ink transition-[translate] duration-(--motion-move) ease-(--ease-in-out) data-ready:block"
    />
  );
}
