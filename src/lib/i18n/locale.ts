import { z } from "zod";

// Spec 053: Spanish by default, English as an option (RF-1, RF-2).
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

/** A copy of profiles.locale on the device, like the theme (RF-1, plan D2). */
export const LOCALE_COOKIE = "cafam-locale";

export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;

export const localeSchema = z.enum(LOCALES, {
  error: "Elige un idioma de la lista.",
});

export function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

/** English only when it is the first language the browser prefers; with doubt, Spanish (RF-2). */
export function localeFromAcceptLanguage(
  header: string | null | undefined,
): Locale {
  const first = header?.split(",")[0]?.split(";")[0]?.trim().toLowerCase();
  return first === "en" || first?.startsWith("en-") ? "en" : DEFAULT_LOCALE;
}

/** Cookie, then the profile, then the browser (plan "Servidor"). */
export function pickLocale(sources: {
  cookie?: string | null;
  profile?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(sources.cookie)) return sources.cookie;
  if (isLocale(sources.profile)) return sources.profile;
  return localeFromAcceptLanguage(sources.acceptLanguage);
}

/** 24-hour clock and Monday first in both (plan D3). */
export function intlLocale(locale: Locale): "es-ES" | "en-GB" {
  return locale === "en" ? "en-GB" : "es-ES";
}

/** Sets <html lang> before the first paint, like the theme script (RF-6). */
export const LOCALE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${LOCALE_COOKIE}=(es|en)(?:;|$)/);if(m)document.documentElement.lang=m[1]}catch(e){}})();`;
