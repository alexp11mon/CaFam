"use client";

import { useEffect, useState } from "react";

/** --motion-base-out: how long the old text stays while it fades. */
const LEAVE_MS = 176;

/**
 * A text that cross-fades when it changes: the old one stays in a layer that
 * fades out while the new one fades in, in the same cell, with no blank beat
 * in between (spec 021 RF-52).
 */
export function CrossfadeText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const [old, setOld] = useState<string | null>(null);
  if (text !== shown) {
    setOld(shown);
    setShown(text);
  }

  useEffect(() => {
    if (old === null) return;
    const timer = setTimeout(() => setOld(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [old]);

  return (
    <span className={`swap min-w-0 ${className}`}>
      {old !== null ? (
        <span key={`old:${old}`} data-leaving="" aria-hidden="true">
          {old}
        </span>
      ) : null}
      <span
        key={shown}
        data-fresh={old !== null || undefined}
        className="truncate"
      >
        {shown}
      </span>
    </span>
  );
}
