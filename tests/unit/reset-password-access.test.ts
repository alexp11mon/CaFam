import { describe, expect, it } from "vitest";
import { getRouteAccess } from "@/lib/auth/route-access";

// Spec 006, T11: the page that sets a password needs a session (recovery or normal).
describe("/reset-password access", () => {
  it("without a session goes to login", () => {
    expect(getRouteAccess("/reset-password", false)).toEqual({
      type: "redirect",
      destination: "/login",
    });
  });

  it("with a session is allowed", () => {
    expect(getRouteAccess("/reset-password", true)).toEqual({ type: "allow" });
  });

  it("the forgot-password page stays public", () => {
    expect(getRouteAccess("/forgot-password", false)).toEqual({
      type: "allow",
    });
  });
});
