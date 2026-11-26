"use client";

import type { ComponentProps } from "react";
import { useEnterOnce } from "@/lib/hooks/use-enter-once";
import { useT } from "@/components/i18n/locale-provider";

/**
 * A list whose rows land 30 ms apart when it first appears, and never again
 * when Activity shows it back (spec 021 RF-16..RF-18, plan D7).
 */
export function StaggerList({
  className = "",
  "aria-label": label,
  ...props
}: ComponentProps<"ul">) {
  const t = useT();
  const entering = useEnterOnce();
  return (
    <ul
      {...props}
      aria-label={label && t(label)}
      data-entering={entering || undefined}
      className={`stagger ${className}`}
    />
  );
}
