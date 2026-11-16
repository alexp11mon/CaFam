import { describe, expect, it } from "vitest";
import { BAR_ICON, BAR_ITEM, TAB_ITEM } from "@/components/shell/bar-styles";

// Spec 011, T10: the bottom bar items answer the pointer (RF-16; plan micro).
describe("bar styles (RF-16)", () => {
  it("the item presses and its icon keeps the color fade", () => {
    // Rows and destinations press without lifting (spec 021 RF-13).
    expect(BAR_ITEM.split(" ")).toContain("press-quiet");
    // 44 px or more to touch (spec 025 RNF-2).
    expect(BAR_ITEM.split(" ")).toContain("min-h-12");
    expect(BAR_ICON.split(" ")).toContain("transition-colors");
    // The current one on the soft accent; a desktop tab in the gradient
    // (spec 030 RF-5, RF-6).
    expect(BAR_ITEM).toContain("aria-[current=page]:bg-accent-soft");
    expect(TAB_ITEM).toContain("aria-[current=page]:bg-accent-gradient");
  });
});
