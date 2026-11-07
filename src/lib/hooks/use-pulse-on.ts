"use client";

import { useEffect, useRef, type RefObject } from "react";
import { pulse } from "@/lib/motion/play";

/**
 * Pulses the control once per successful result (spec 021 RF-47): `success`
 * is the result object when it saved, else a falsy value. Activity replays
 * effects when a route shows again, so each result is handled only once.
 */
export function usePulseOn(
  ref: RefObject<HTMLElement | null>,
  success: object | null | undefined | false,
) {
  const handled = useRef<object | null>(null);
  useEffect(() => {
    if (!success || handled.current === success) return;
    handled.current = success;
    if (ref.current) pulse(ref.current);
  }, [ref, success]);
}
