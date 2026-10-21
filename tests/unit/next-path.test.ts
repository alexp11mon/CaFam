import { describe, expect, it } from "vitest";
import { getSafeNextPath } from "@/lib/auth/next-path";

const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

describe("getSafeNextPath (RF-7, plan D9)", () => {
  it("accepts only /invite/<token>", () => {
    expect(getSafeNextPath(`/invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
  });

  it("accepts tokens of 16 to 128 base64url characters", () => {
    expect(getSafeNextPath(`/invite/${"a".repeat(16)}`)).toBe(
      `/invite/${"a".repeat(16)}`,
    );
    expect(getSafeNextPath(`/invite/${"a".repeat(128)}`)).toBe(
      `/invite/${"a".repeat(128)}`,
    );
    expect(getSafeNextPath(`/invite/${"a".repeat(15)}`)).toBe("/dashboard");
    expect(getSafeNextPath(`/invite/${"a".repeat(129)}`)).toBe("/dashboard");
  });

  it.each([
    "https://evil.example.com/invite/" + TOKEN,
    "//evil.example.com",
    "//evil.example.com/invite/" + TOKEN,
    "/dashboard",
    "/dashboard/calendar",
    `/invite/${TOKEN}?x=1`,
    `/invite/${TOKEN}#top`,
    `/invite/${TOKEN}/more`,
    "/invite/",
    "/invite/has space aaaaaaaaaaaa",
    "/invite/../../etc/passwdaaaaaaaa",
    "",
    undefined,
    null,
    42,
  ])("falls back to /dashboard for %j", (next) => {
    expect(getSafeNextPath(next)).toBe("/dashboard");
  });
});
