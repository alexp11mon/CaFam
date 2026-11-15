import { describe, expect, it } from "vitest";
import { BAR_ICON, BAR_ITEM } from "@/components/shell/bar-styles";

// Spec 011, T10: the bottom bar items answer the pointer (RF-16; plan micro).
describe("bar styles (RF-16)", () => {
  it("the item presses and its icon keeps the color fade", () => {
    // Rows and destinations press without lifting (spec 021 RF-13).
    expect(BAR_ITEM.split(" ")).toContain("press-quiet");
    // 44 px or more to touch (spec 025 RNF-2).
    expect(BAR_ITEM.split(" ")).toContain("min-h-14");
    expect(BAR_ICON.split(" ")).toContain("transition-colors");
  });
});
