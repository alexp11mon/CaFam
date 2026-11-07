"use client";

import type { ComponentProps } from "react";
import { useEnterOnce } from "@/lib/hooks/use-enter-once";

/**
 * A list whose rows land 30 ms apart when it first appears, and never again
 * when Activity shows it back (spec 021 RF-16..RF-18, plan D7).
 */
export function StaggerList({
  className = "",
  ...props
}: ComponentProps<"ul">) {
  const entering = useEnterOnce();
  return (
    <ul
      {...props}
      data-entering={entering || undefined}
      className={`stagger ${className}`}
    />
  );
}
