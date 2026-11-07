import { holdLive } from "@/lib/calendar/live-hold";
import { boxOf, type Box } from "@/lib/calendar/popover";
import { EASE_IN_OUT, motionMs, motionToken, play } from "./play";

/**
 * An event block that grows into its detail and shrinks back (spec 021
 * RF-55..RF-61, plan motion-morph, D2): `translate` and `clip-path`, never
 * `scale`, so no text is stretched. A layer in the event's color covers the
 * surface and fades from 40 % of the way, so the block's look turns into the
 * detail's content.
 */
export type MorphOrigin = {
  eventId: string;
  /** The month segment pressed, for events across several weeks. */
  segment?: string;
  box: Box;
  color: string;
};

const TTL_MS = 1000;
const BLOCK_RADIUS = 8;
const SURFACE_RADIUS = 24;
let origin: { value: MorphOrigin; at: number } | null = null;

/** The block just pressed, so its detail can grow from it. */
export function setMorphOrigin(value: MorphOrigin) {
  origin = { value, at: Date.now() };
}

/** That block, once and only for its own event, within 1 s (RF-59). */
export function takeMorphOrigin(eventId: string): MorphOrigin | null {
  const entry = origin;
  origin = null;
  if (!entry || entry.value.eventId !== eventId) return null;
  if (Date.now() - entry.at > TTL_MS) return null;
  return entry.value;
}

function onScreen({ left, top, width, height }: Box) {
  return (
    width > 0 &&
    height > 0 &&
    left + width > 0 &&
    top + height > 0 &&
    left < window.innerWidth &&
    top < window.innerHeight
  );
}

/**
 * The event's block on screen now: Activity keeps hidden copies of a view and
 * a long event has several month segments (plan R4); null if none (RF-58).
 */
export function findVisibleBlock(
  eventId: string,
  segment?: string,
): HTMLElement | null {
  const shown = [
    ...document.querySelectorAll<HTMLElement>(
      `[data-event-id="${CSS.escape(eventId)}"]`,
    ),
  ].filter((el) => (el.checkVisibility?.() ?? true) && onScreen(boxOf(el)));
  return (
    shown.find((el) => segment && el.dataset.segment === segment) ??
    shown[0] ??
    null
  );
}

const px = (value: number) => `${Math.round(value * 100) / 100}px`;

/** The surface drawn only over `block`'s box. */
function asBlock(surface: Box, block: Box): Keyframe {
  return {
    translate: `${px(block.left - surface.left)} ${px(block.top - surface.top)}`,
    clipPath: `inset(0px ${px(Math.max(0, surface.width - block.width))} ${px(Math.max(0, surface.height - block.height))} 0px round ${BLOCK_RADIUS}px)`,
  };
}

const WHOLE: Keyframe = {
  translate: "0px 0px",
  clipPath: `inset(0px 0px 0px 0px round ${SURFACE_RADIUS}px)`,
};

function run(
  el: HTMLElement,
  frames: Keyframe[],
  color: string,
  layerFrames: Keyframe[],
): Promise<void> {
  const release = holdLive();
  // Opaque while it moves: glass over a moving clip is costly (plan R3).
  el.dataset.morph = "";
  const layer = document.createElement("span");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:absolute;inset:0;z-index:10;pointer-events:none;border-radius:inherit;background-color:${color}`;
  el.append(layer);
  const options = {
    duration: motionMs("--motion-move", 300),
    easing: motionToken("--ease-in-out", EASE_IN_OUT),
  };
  const animation = play(el, frames, { ...options, fill: "forwards" });
  play(layer, layerFrames, options);
  const end = () => {
    layer.remove();
    delete el.dataset.morph;
    release();
  };
  if (!animation) {
    end();
    return Promise.resolve();
  }
  return animation.finished.then(end, end);
}

/** The surface grows out of `from`, the block (RF-55, RF-56). */
export function morphIn(el: HTMLElement, from: Box, color: string) {
  return run(el, [asBlock(boxOf(el), from), WHOLE], color, [
    { opacity: 1 },
    { opacity: 1, offset: 0.4 },
    { opacity: 0 },
  ]).then(() => {
    // The last frame stayed inline: the surface is whole again.
    el.style.removeProperty("translate");
    el.style.removeProperty("clip-path");
  });
}

/** The surface shrinks into `to`, where the block is now (RF-57). */
export function morphOut(el: HTMLElement, to: Box, color: string) {
  return run(el, [WHOLE, asBlock(boxOf(el), to)], color, [
    { opacity: 0 },
    { opacity: 1, offset: 0.6 },
    { opacity: 1 },
  ]);
}
