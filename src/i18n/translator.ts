import { EN } from "@/i18n/en";
import type { Locale } from "@/lib/i18n/locale";
import { makeT, spanishT, type T } from "@/lib/i18n/translate";

// Spec 053 (plan D11): texts the server builds with values inside (the
// assistant's statuses and proposals) are translated where they are built.
// Server only: the catalog must never reach the Spanish client bundle.
export function translator(locale: Locale): T {
  return locale === "en" ? makeT(EN) : spanishT;
}
