import type { HTMLAttributes } from "react";

/** A surface at rest with the card radius: one idea per card (spec 025 RF-6). */
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`surface rounded-card p-4 ${className}`} {...props} />;
}
