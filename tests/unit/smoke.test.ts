import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("runs the unit test environment with a DOM", () => {
    const element = document.createElement("div");
    element.textContent = "CaFam";

    expect(element.textContent).toBe("CaFam");
  });
});
