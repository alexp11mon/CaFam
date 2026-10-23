import { describe, expect, it } from "vitest";
import { getConfirmNotice } from "@/lib/account/confirm-type";

// Spec 006, T18: Ajustes explains an email change link that did not work (RF-12).
describe("getConfirmNotice (RF-12)", () => {
  it("explains an invalid or expired email change link", () => {
    expect(getConfirmNotice("invalid")).toBe(
      "El enlace no es válido o ha caducado. Pide uno nuevo.",
    );
  });

  it("shows nothing otherwise", () => {
    expect(getConfirmNotice(undefined)).toBeNull();
    expect(getConfirmNotice("cualquier-cosa")).toBeNull();
  });
});
