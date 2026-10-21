"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Scroll container that starts at `top` px, so the day grid opens on the morning, not at midnight. */
export function ScrollOnMount({
  top,
  className,
  children,
}: {
  top: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = top;
  }, [top]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
