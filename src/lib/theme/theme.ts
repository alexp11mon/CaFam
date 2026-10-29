// The light and dark themes a user can pick (spec 011 RF-1, RF-2, RF-6, RF-7;
// plan theme-core, D3). The choice lives in profiles.theme and, on each
// device, in the cafam-theme cookie that the boot script reads before paint.
import { z } from "zod";
import { DARK_NEUTRALS, NEUTRALS } from "./accents";

export const THEME_IDS = ["light", "dark", "system"] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type EffectiveTheme = Exclude<ThemeId, "system">;

export const DEFAULT_THEME: ThemeId = "system";

export const THEME_COOKIE = "cafam-theme";

/** The system bar color of each theme (RF-11): the stone ground. */
export const THEME_COLOR: Record<EffectiveTheme, string> = {
  light: NEUTRALS.stone,
  dark: DARK_NEUTRALS.stone,
};

export const themeSchema = z.enum(THEME_IDS, {
  error: "Elige uno de los temas disponibles.",
});

export function parseTheme(value: unknown): ThemeId {
  return THEME_IDS.find((id) => id === value) ?? DEFAULT_THEME;
}

/** What is on screen: "system" follows the OS preference. */
export function effectiveTheme(
  theme: ThemeId,
  prefersDark: boolean,
): EffectiveTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

/** The shortcut flips what is on screen; "system" is only picked in Ajustes (plan D14). */
export function nextToggleTheme(effective: EffectiveTheme): EffectiveTheme {
  return effective === "dark" ? "light" : "dark";
}

/**
 * Inlined in <head> so the first frame already has the chosen theme (RF-7).
 * Without the cookie, or with "system", CSS follows prefers-color-scheme.
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);if(!m)return;var t=m[1];document.documentElement.setAttribute("data-theme",t);var c=t==="dark"?"${THEME_COLOR.dark}":"${THEME_COLOR.light}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",c)})}catch(e){}})();`;
