import { intlLocale, type Locale } from "./locale";

const rules = new Map<Locale, Intl.PluralRules>();

/**
 * The Spanish form for n; it is also the key of its English translation
 * (plan D7). Spanish and English share "one" and "other" for counts.
 */
export function plural(
  n: number,
  one: string,
  other: string,
  locale: Locale = "es",
): string {
  let rule = rules.get(locale);
  if (!rule) {
    rule = new Intl.PluralRules(intlLocale(locale));
    rules.set(locale, rule);
  }
  return rule.select(n) === "one" ? one : other;
}
