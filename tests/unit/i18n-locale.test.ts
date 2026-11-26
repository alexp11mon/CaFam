import { describe, expect, it } from "vitest";
import {
  intlLocale,
  localeFromAcceptLanguage,
  localeSchema,
  pickLocale,
} from "@/lib/i18n/locale";
import { interpolate, makeT, spanishT } from "@/lib/i18n/translate";

// Spec 053 T1: which language, and how a text is translated (RF-1, RF-2, plan D7).

describe("locale", () => {
  it("is English only when the browser prefers it first (RF-2)", () => {
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9,es;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("en")).toBe("en");
    expect(localeFromAcceptLanguage("es-ES,en;q=0.9")).toBe("es");
    expect(localeFromAcceptLanguage("fr-FR,en;q=0.9")).toBe("es");
    expect(localeFromAcceptLanguage(null)).toBe("es");
  });

  it("takes the cookie, then the profile, then the browser", () => {
    expect(pickLocale({ cookie: "en", profile: "es" })).toBe("en");
    expect(pickLocale({ cookie: "xx", profile: "en" })).toBe("en");
    expect(pickLocale({ acceptLanguage: "en-US" })).toBe("en");
    expect(pickLocale({})).toBe("es");
  });

  it("validates the choice and maps it to Intl (plan D3)", () => {
    expect(localeSchema.safeParse("en").success).toBe(true);
    expect(localeSchema.safeParse("fr").error?.issues[0]?.message).toBe(
      "Elige un idioma de la lista.",
    );
    expect(intlLocale("en")).toBe("en-GB");
    expect(intlLocale("es")).toBe("es-ES");
  });
});

describe("translate", () => {
  it("returns the Spanish text itself without a catalog", () => {
    expect(spanishT("Guardar")).toBe("Guardar");
    expect(spanishT("Hola, {name}", { name: "Ana" })).toBe("Hola, Ana");
  });

  it("uses the English catalog, and the Spanish text when a key is missing", () => {
    const t = makeT({ Guardar: "Save", "Hola, {name}": "Hi, {name}" });
    expect(t("Guardar")).toBe("Save");
    expect(t("Hola, {name}", { name: "Ana" })).toBe("Hi, Ana");
    expect(t("Sin traducir")).toBe("Sin traducir");
  });

  it("leaves unknown placeholders alone", () => {
    expect(interpolate("{a} y {b}", { a: 1 })).toBe("1 y {b}");
  });
});
