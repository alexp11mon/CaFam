import type { ReactNode } from "react";

/**
 * Two icons in one place: the one that goes shrinks, blurs and fades while
 * the other does the reverse (spec 021 RF-54). Only the shown one is read.
 */
export function IconSwap({
  show,
  a,
  b,
}: {
  show: "a" | "b";
  a: ReactNode;
  b: ReactNode;
}) {
  return (
    <span className="swap" data-icons="">
      <span
        data-off={show !== "a" || undefined}
        aria-hidden={show !== "a" || undefined}
        className="inline-flex"
      >
        {a}
      </span>
      <span
        data-off={show !== "b" || undefined}
        aria-hidden={show !== "b" || undefined}
        className="inline-flex"
      >
        {b}
      </span>
    </span>
  );
}
