import { describe, expect, it } from "vitest";
import { EN } from "@/i18n/en";
import { limits } from "@/i18n/en/limits";
import { allLiterals, spanishLiterals, translatedTexts } from "./i18n-scan";
import { NOT_SHOWN, PENDING } from "./i18n-pending";

// Spec 053 T2 (RF-8): every Spanish text of the interface has its English one.

const skipped = (file: string) =>
  NOT_SHOWN.some((prefix) => file.startsWith(prefix)) || PENDING.has(file);

describe("the English catalog", () => {
  it("has every text passed to t(), plural() and <T>", () => {
    const missing = [...translatedTexts()]
      .filter(([text]) => !(text in EN))
      .map(([text, file]) => `${file}: ${text}`);
    expect(missing).toEqual([]);
  });

  it("has every Spanish message of the modules", () => {
    const missing = spanishLiterals()
      .filter(({ file, text }) => !skipped(file) && !(text in EN))
      .map(({ file, text }) => `${file}: ${text}`);
    expect(missing).toEqual([]);
  });

  it("has nothing the sources no longer say", () => {
    const literals = allLiterals();
    const keys = new Set(translatedTexts().keys());
    expect(
      Object.keys(EN).filter(
        // limits.ts builds its keys from the limits themselves.
        (key) => !keys.has(key) && !literals.has(key) && !(key in limits),
      ),
    ).toEqual([]);
  });

  it("keeps the same placeholders", () => {
    const names = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(
      Object.entries(EN).filter(
        ([es, en]) => names(es).join() !== names(en).join(),
      ),
    ).toEqual([]);
  });
});
