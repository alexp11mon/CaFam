"use client";

import { useId, useRef } from "react";
import { EASE_IN_OUT, motionMs, motionToken, play } from "@/lib/motion/play";

/**
 * An on/off setting saved at once (spec 021 RF-40..RF-46, plan D10): a button
 * with role="switch", so Space and Enter work and it is announced with its
 * name. The knob is right when on and left when off, whatever the color, and
 * stretches along its path keeping its area (RF-43, RF-44). The parent turns
 * `checked` back if saving fails (RF-45).
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  pending = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  pending?: boolean;
}) {
  const descriptionId = useId();
  const knob = useRef<HTMLSpanElement>(null);

  function stretch() {
    if (!knob.current) return;
    const x = Number(motionToken("--knob-stretch", "1.12")) || 1;
    // Wider along the path, thinner across, the same area (RF-43).
    play(
      knob.current,
      [{ scale: "1 1" }, { scale: `${x} ${1 / x}` }, { scale: "1 1" }],
      {
        duration: motionMs("--motion-base-in", 220),
        easing: motionToken("--ease-in-out", EASE_IN_OUT),
      },
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={pending || undefined}
        disabled={disabled}
        onClick={() => {
          stretch();
          onCheckedChange(!checked);
        }}
        className="press-quiet flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-xl text-left text-base font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">{label}</span>
        <span
          aria-hidden="true"
          className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-(--motion-base-in) ease-(--ease-in-out) ${checked ? "border-ink bg-ink" : "border-control bg-control"}`}
        >
          <span
            ref={knob}
            data-knob=""
            // A transition, so a press half-way turns it round where it is.
            className={`size-5 rounded-full bg-paper transition-[translate] duration-(--motion-base-in) ease-(--ease-in-out) ${checked ? "translate-x-5.75" : "translate-x-0.75"}`}
          />
        </span>
      </button>
      {description ? (
        <p id={descriptionId} className="text-sm text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}
