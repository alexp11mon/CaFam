"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { LayoutEventInput } from "@/lib/calendar/layout";

// Someone else's busy time in the week and day grid (spec 020 RF-8, RF-9,
// RF-11, RF-14, RF-15; plan D6). Not an event: no link, no id, no drag, no
// menu; it only tells who is busy and when.

export interface BusyGridItem extends LayoutEventInput {
  personId: string;
  name: string;
  /** The person's avatar tint (spec 005 RF-28). */
  tint: string;
}

export function isBusyItem(item: LayoutEventInput): item is BusyGridItem {
  return "personId" in item;
}

export function BusyBlock({
  item,
  hours,
  className = "",
  style,
}: {
  item: BusyGridItem;
  /** "09:00 – 11:00", or null for an all-day block. */
  hours: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const root = useRef<HTMLDivElement>(null);
  const label = `Ocupado · ${item.name}`;

  // Escape or a press outside closes the note (RF-14).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={`${className} ${open ? "z-30" : ""}`}
      style={style}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? noteId : undefined}
        aria-label={`${label}, ${hours ?? "todo el día"}`}
        onClick={() => setOpen((value) => !value)}
        // The tint marks the person; no pastel fill, unlike events (plan D6).
        style={{ borderLeftColor: item.tint }}
        className="press-quiet flex size-full flex-col overflow-hidden rounded-md border border-l-4 border-line bg-busy-hatch px-1 text-left text-xs text-ink focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span className="truncate font-semibold">{label}</span>
        <span className="truncate tabular-nums text-muted">
          {hours ?? "Todo el día"}
        </span>
      </button>
      {open ? (
        <div
          id={noteId}
          role="dialog"
          aria-label={item.name}
          className="absolute top-full left-0 z-30 mt-1 w-max max-w-56 rounded-2xl glass-float p-3 text-sm text-ink"
        >
          <p className="font-semibold">{item.name}</p>
          <p className="tabular-nums">
            {hours
              ? `Ocupado de ${hours.replace(" – ", " a ")}`
              : "Ocupado todo el día"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
