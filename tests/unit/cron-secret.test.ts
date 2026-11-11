// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasCronSecret } from "@/lib/auth/cron-secret";

function request(authorization?: string) {
  return new Request("https://cafam.test/api/sync/run", {
    headers: authorization ? { authorization } : {},
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("hasCronSecret (spec 023 RF-6)", () => {
  it("accepts only the exact bearer", () => {
    vi.stubEnv("CRON_SECRET", "s3cret-value");

    expect(hasCronSecret(request("Bearer s3cret-value"))).toBe(true);
    for (const wrong of [
      undefined,
      "",
      "s3cret-value",
      "Bearer s3cret-valuX",
      "Bearer s3cret",
      "Bearer s3cret-value-and-more",
      "bearer s3cret-value",
    ]) {
      expect(hasCronSecret(request(wrong))).toBe(false);
    }
  });

  it("refuses everything when the secret is not configured", () => {
    vi.stubEnv("CRON_SECRET", "");

    expect(hasCronSecret(request("Bearer "))).toBe(false);
    expect(hasCronSecret(request("Bearer undefined"))).toBe(false);
  });
});
