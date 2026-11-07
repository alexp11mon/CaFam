import type { Box } from "@/lib/calendar/popover";

export type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/**
 * The transform-origin of a popover: the point of the panel nearest to the
 * centre of its trigger, in px relative to the panel, so it grows from and
 * shrinks back to the trigger (spec 021 RF-8..RF-10, plan D4).
 */
export function originFrom(trigger: Box | Point, panel: Box): string {
  const x = "x" in trigger ? trigger.x : trigger.left + trigger.width / 2;
  const y = "y" in trigger ? trigger.y : trigger.top + trigger.height / 2;
  const left = clamp(x, panel.left, panel.left + panel.width) - panel.left;
  const top = clamp(y, panel.top, panel.top + panel.height) - panel.top;
  return `${Math.round(left)}px ${Math.round(top)}px`;
}
