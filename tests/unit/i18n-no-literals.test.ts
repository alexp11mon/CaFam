import { describe, expect, it } from "vitest";
import { spanishLiterals, strayTexts } from "./i18n-scan";
import { NOT_SHOWN, PENDING } from "./i18n-pending";

// Spec 053 T2 (RF-8): no Spanish shown without t() or <T>. PENDING lists the
// files still to migrate and must end empty (T7).
describe("texts outside the catalog", () => {
  it("no component shows Spanish without t() or <T>", () => {
    expect(
      strayTexts()
        .filter(({ file }) => !PENDING.has(file))
        .map(({ file, line, text }) => `${file}:${line} ${text}`),
    ).toEqual([]);
  });

  it("every pending file still has something to migrate", () => {
    const left = new Set([
      ...strayTexts().map(({ file }) => file),
      ...spanishLiterals()
        .filter(({ file }) => !NOT_SHOWN.some((p) => file.startsWith(p)))
        .map(({ file }) => file),
    ]);
    expect([...PENDING].filter((file) => !left.has(file))).toEqual([]);
  });
});
