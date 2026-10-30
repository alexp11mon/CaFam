"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll container that starts at `top()` px when `scrollKey` changes, so the
 * grid opens on the current hour or the morning, not at midnight (spec 016
 * RF-45). `top` is read in the effect: the clock never runs during render.
 */
export function ScrollOnMount({
  top,
  scrollKey,
  className,
  children,
}: {
  top: () => number;
  scrollKey: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const latestTop = useRef(top);

  useEffect(() => {
    latestTop.current = top;
  });

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = latestTop.current();
  }, [scrollKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
