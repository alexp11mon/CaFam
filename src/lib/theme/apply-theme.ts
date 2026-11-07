// Puts a theme on the page in the browser: the attribute on <html>, the
// system bar color and the device cookie (spec 011 RF-3, RF-4, RF-11; plan
// theme-apply).
import {
  THEME_COLOR,
  THEME_COOKIE,
  THEME_COOKIE_OPTIONS,
  type ThemeId,
} from "./theme";

export function readThemeCookie(): string | undefined {
  return document.cookie.match(
    new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`),
  )?.[1];
}

function writeThemeCookie(theme: ThemeId) {
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=${THEME_COOKIE_OPTIONS.path}; max-age=${THEME_COOKIE_OPTIONS.maxAge}; samesite=${THEME_COOKIE_OPTIONS.sameSite}${secure}`;
}

/** Without animation. "system" drops the attribute and lets each meta keep its media color. */
export function paintTheme(theme: ThemeId) {
  const html = document.documentElement;
  if (theme === "system") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", theme);
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => {
      const scheme =
        theme !== "system"
          ? theme
          : meta.media.includes("dark")
            ? "dark"
            : "light";
      meta.content = THEME_COLOR[scheme];
    });
  writeThemeCookie(theme);
}

export type RevealOrigin = { x: number; y: number };

const REVEAL_VARS = ["--reveal-x", "--reveal-y", "--reveal-r"];

/**
 * Repaints the page through a view transition (spec 011 RF-21). With an
 * origin, the new look grows as a circle from it up to the farthest corner
 * (spec 021 RF-36, RF-37, plan D9). Without view transitions or with reduced
 * motion it repaints at once (RF-23, RF-39).
 */
export function revealPaint(paint: () => void, origin?: RevealOrigin) {
  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!document.startViewTransition || reduced) {
    paint();
    return;
  }
  const html = document.documentElement;
  if (origin) {
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    html.style.setProperty("--reveal-x", `${origin.x}px`);
    html.style.setProperty("--reveal-y", `${origin.y}px`);
    html.style.setProperty("--reveal-r", `${Math.ceil(radius)}px`);
    html.dataset.reveal = "";
  }
  const transition = document.startViewTransition(paint);
  const done = () => {
    delete html.dataset.reveal;
    for (const name of REVEAL_VARS) html.style.removeProperty(name);
  };
  if (transition?.finished) transition.finished.then(done, done);
  else done();
}

/** A theme picked in the browser: a fade or a circle from `origin`, at once with reduced motion. */
export function applyTheme(theme: ThemeId, origin?: RevealOrigin) {
  revealPaint(() => paintTheme(theme), origin);
}

/** The centre of an element on screen, where a reveal starts. */
export function centreOf(element: Element): RevealOrigin {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}
