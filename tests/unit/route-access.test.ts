import { describe, expect, it } from "vitest";
import { getRouteAccess } from "@/lib/auth/route-access";

const PUBLIC_PATHS = [
  "/",
  "/offline",
  "/sw.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/favicon.ico",
];

describe("getRouteAccess", () => {
  describe("without session (RF-8)", () => {
    it.each(["/dashboard", "/dashboard/x", "/dashboard/x/y"])(
      "redirects %s to /login",
      (pathname) => {
        expect(getRouteAccess(pathname, false)).toEqual({
          type: "redirect",
          destination: "/login",
        });
      },
    );

    it.each(["/login", "/signup", "/dashboardx", ...PUBLIC_PATHS])(
      "allows %s",
      (pathname) => {
        expect(getRouteAccess(pathname, false)).toEqual({ type: "allow" });
      },
    );
  });

  describe("invite links (RF-7)", () => {
    const token = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

    it("sends a visitor without session to /login keeping the invite", () => {
      expect(getRouteAccess(`/invite/${token}`, false)).toEqual({
        type: "redirect",
        destination: `/login?next=%2Finvite%2F${token}`,
      });
    });

    it("lets a user with session in", () => {
      expect(getRouteAccess(`/invite/${token}`, true)).toEqual({
        type: "allow",
      });
    });

    it("does not treat /invite or /invitex as an invite", () => {
      for (const pathname of ["/invite", "/invite/", "/invitex/abc"]) {
        expect(getRouteAccess(pathname, false)).toEqual({ type: "allow" });
      }
    });
  });

  describe("with session (RF-9)", () => {
    it.each(["/login", "/signup"])(
      "redirects %s to the calendar (spec 005 RF-15)",
      (pathname) => {
        expect(getRouteAccess(pathname, true)).toEqual({
          type: "redirect",
          destination: "/dashboard/calendar",
        });
      },
    );

    it.each(["/dashboard", "/dashboard/x", ...PUBLIC_PATHS])(
      "allows %s",
      (pathname) => {
        expect(getRouteAccess(pathname, true)).toEqual({ type: "allow" });
      },
    );
  });
});
