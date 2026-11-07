"use client";

import { useEffect, useState } from "react";

/**
 * Keeps something that closes mounted, marked as leaving, until its exit
 * animation of `exitMs` ends; opening again cancels the exit (spec 021 RF-9,
 * RF-65, plan D3).
 */
export function usePresence(
  open: boolean,
  exitMs: number,
): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMounted(true);
  }

  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, mounted, exitMs]);

  return { mounted: open || mounted, leaving: !open && mounted };
}
