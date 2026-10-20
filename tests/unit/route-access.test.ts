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

  describe("with session (RF-9)", () => {
    it.each(["/login", "/signup"])("redirects %s to /dashboard", (pathname) => {
      expect(getRouteAccess(pathname, true)).toEqual({
        type: "redirect",
        destination: "/dashboard",
      });
    });

    it.each(["/dashboard", "/dashboard/x", ...PUBLIC_PATHS])(
      "allows %s",
      (pathname) => {
        expect(getRouteAccess(pathname, true)).toEqual({ type: "allow" });
      },
    );
  });
});
