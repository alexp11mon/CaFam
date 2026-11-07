/** The curves and durations of globals.css, for animations made in JS. */
export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

const REDUCED = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia?.(REDUCED).matches ?? false)
  );
}

/** A token of :root read at run time, so the review can tune it in CSS. */
export function motionToken(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** A duration token in ms (`"220ms"` → 220). */
export function motionMs(name: string, fallback: number): number {
  const value = motionToken(name, "");
  const ms = /^(\d+(?:\.\d+)?)(ms|s)$/.exec(value);
  if (!ms) return fallback;
  return Number(ms[1]) * (ms[2] === "s" ? 1000 : 1);
}

type Options = {
  duration: number;
  easing?: string;
  delay?: number;
  /** "forwards" keeps the last frame inline once it ends. */
  fill?: "forwards" | "none";
};

const running = new WeakMap<Element, Animation>();

function styleOf(el: Element): CSSStyleDeclaration | null {
  return "style" in el ? (el as HTMLElement).style : null;
}

function apply(el: Element, frame: Keyframe) {
  const style = styleOf(el);
  if (!style) return;
  for (const [prop, value] of Object.entries(frame)) {
    if (prop === "offset" || prop === "easing" || prop === "composite")
      continue;
    style.setProperty(
      prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      value == null ? "" : String(value),
    );
  }
}

function clear(el: Element, frame: Keyframe) {
  const style = styleOf(el);
  if (!style) return;
  for (const prop of Object.keys(frame)) {
    style.removeProperty(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
  }
}

/**
 * Runs keyframes on `el`, first freezing whatever already runs there where it
 * is, so the new movement starts from the current state (spec 021 RF-63,
 * RF-64, plan D15). Without `animate` (jsdom) or with reduced motion it jumps
 * to the end and returns null (RF-66, RF-67).
 */
export function play(
  el: Element,
  keyframes: Keyframe[],
  { duration, easing = EASE_OUT, delay = 0, fill = "none" }: Options,
): Animation | null {
  const previous = running.get(el);
  if (previous) {
    try {
      previous.commitStyles();
    } catch {
      // A detached element cannot commit; the next animation starts anyway.
    }
    previous.cancel();
    running.delete(el);
  }
  const last = keyframes[keyframes.length - 1] ?? {};
  const settle = () => {
    if (fill === "forwards") apply(el, last);
    else clear(el, last);
  };
  if (typeof el.animate !== "function" || prefersReducedMotion()) {
    settle();
    return null;
  }
  const animation = el.animate(keyframes, { duration, easing, delay });
  running.set(el, animation);
  animation.onfinish = () => {
    if (running.get(el) === animation) running.delete(el);
    settle();
  };
  return animation;
}

/** One small pulse that confirms a success (spec 021 RF-47, RF-49). */
export function pulse(el: Element | null | undefined) {
  if (!el || prefersReducedMotion()) return;
  const scale = motionToken("--pulse-scale", "1.04");
  play(el, [{ scale: "1" }, { scale }, { scale: "1" }], {
    duration: motionMs("--motion-pulse", 300),
    easing: motionToken("--ease-in-out", EASE_IN_OUT),
  });
}
