import { intlLocale, type Locale } from "./locale";

// Spec 053 RF-4: dates, numbers and lists in the chosen language, 24-hour
// clock in both (plan D3). Formatters are cached: building them is slow.
const cache = new Map<string, Intl.DateTimeFormat>();

export function dateFormat(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let format = cache.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(locale), {
      ...(options.hour !== undefined ? { hourCycle: "h23" } : {}),
      ...options,
    });
    cache.set(key, format);
  }
  return format;
}

export function formatList(locale: Locale, items: readonly string[]): string {
  return new Intl.ListFormat(intlLocale(locale), {
    style: "long",
    type: "conjunction",
  }).format(items);
}

/** Groups thousands in both languages ("2.000", "2,000"); es-ES alone would not. */
export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    useGrouping: "always",
  }).format(n);
}
