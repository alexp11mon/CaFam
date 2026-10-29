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

/** A theme picked in the browser: a fade where it can, at once with reduced motion (RF-21, RF-23, RF-24). */
export function applyTheme(theme: ThemeId) {
  const reduced = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (document.startViewTransition && !reduced) {
    document.startViewTransition(() => paintTheme(theme));
  } else {
    paintTheme(theme);
  }
}
