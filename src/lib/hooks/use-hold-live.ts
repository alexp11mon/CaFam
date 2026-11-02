"use client";

import { useEffect } from "react";
import { holdLive } from "@/lib/calendar/live-hold";

/** Keeps others' changes waiting while `active` (spec 019 RF-43, plan D6). */
export function useHoldLive(active: boolean) {
  useEffect(() => (active ? holdLive() : undefined), [active]);
}
