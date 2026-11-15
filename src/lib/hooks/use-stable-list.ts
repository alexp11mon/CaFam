"use client";

import { useState } from "react";

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * The same array for as long as it holds the same items in the same order
 * (spec 024 RNF-5): reading more days into the calendar's window builds a new
 * list for the period on screen with the very same events, and a new array
 * would paint the whole view again.
 */
export function useStableList<T>(next: T[]): T[] {
  const [stable, setStable] = useState(next);
  if (stable === next || sameItems(stable, next)) return stable;
  setStable(next);
  return next;
}

/** The same object for as long as it serializes the same (small values only). */
export function useStableJson<T>(next: T): T {
  const [stable, setStable] = useState(next);
  if (stable === next || JSON.stringify(stable) === JSON.stringify(next)) {
    return stable;
  }
  setStable(next);
  return next;
}
