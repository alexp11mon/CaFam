import { boxOf, type Box } from "@/lib/calendar/popover";

/**
 * What an event block does on its next paint, by event id (spec 021 plan
 * motion-marks, D13): fly back from where it was, or pulse once saved. The
 * views remount blocks on every server refresh, so props cannot carry this.
 */
export type Mark = { kind: "return"; from: Box } | { kind: "pulse" };

const TTL_MS = 2000;
const marks = new Map<string, { mark: Mark; at: number }>();

/** The copy of a block on screen: Activity keeps hidden routes in the DOM. */
export function visibleBlock(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(
    `[data-event-id="${CSS.escape(id)}"]`,
  );
  return (
    [...all].find((el) => el.checkVisibility?.() ?? el.isConnected) ?? null
  );
}

/** The saved event pulses once on its next paint (RF-48). */
export function markPulse(id: string) {
  marks.set(id, { mark: { kind: "pulse" }, at: Date.now() });
}

/** Measures the block before it goes back, so it flies from here (RF-20). */
export function captureReturn(id: string) {
  const el = visibleBlock(id);
  if (el)
    marks.set(id, {
      mark: { kind: "return", from: boxOf(el) },
      at: Date.now(),
    });
}

/** The mark of an event, once; null if none or older than 2 s. */
export function takeMark(id: string): Mark | null {
  const entry = marks.get(id);
  marks.delete(id);
  if (!entry || Date.now() - entry.at > TTL_MS) return null;
  return entry.mark;
}
