import { describe, expect, it } from "vitest";
import { BAR_ICON, BAR_ITEM } from "@/components/shell/bar-styles";

// Spec 011, T10: the bottom bar items answer the pointer (RF-16; plan micro).
describe("bar styles (RF-16)", () => {
  it("the item presses and its icon keeps the color fade", () => {
    expect(BAR_ITEM.split(" ")).toContain("press");
    expect(BAR_ICON.split(" ")).toContain("transition-colors");
  });
});
