import { describe, expect, it } from "vitest";
import { plural } from "@/lib/i18n/plural";

// Spec 053 T1: the Spanish form is the key of the English one (plan D7).
describe("plural", () => {
  it("picks one for 1 and other for the rest, in both languages", () => {
    for (const locale of ["es", "en"] as const) {
      expect(plural(1, "{n} evento", "{n} eventos", locale)).toBe("{n} evento");
      expect(plural(0, "{n} evento", "{n} eventos", locale)).toBe(
        "{n} eventos",
      );
      expect(plural(2, "{n} evento", "{n} eventos", locale)).toBe(
        "{n} eventos",
      );
    }
  });
});
