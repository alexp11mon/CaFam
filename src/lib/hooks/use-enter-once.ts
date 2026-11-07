"use client";

import { useEffect, useState } from "react";

/** The longest entrance of a staggered list (spec 021 RF-17). */
const ENTER_MS = 400;

/**
 * True for the first 400 ms of a list's life. The CSS only staggers under
 * `[data-entering]`, and the state survives Activity, so a list that is hidden
 * and shown again does not replay its entrance (spec 021 RF-16..RF-18, D7).
 */
export function useEnterOnce(): boolean {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    if (!entering) return;
    const timer = setTimeout(() => setEntering(false), ENTER_MS);
    return () => clearTimeout(timer);
  }, [entering]);
  return entering;
}
