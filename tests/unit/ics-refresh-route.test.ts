// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 044, T5: POST /api/ics/refresh, woken up by pg_cron (RF-7, RNF-1).
const { refreshDue } = vi.hoisted(() => ({ refreshDue: vi.fn() }));
vi.mock("@/lib/ics/refresh-engine", () => ({ refreshDue }));

import { maxDuration, POST } from "@/app/api/ics/refresh/route";

const SECRET = "test-cron-secret";

function call(authorization?: string) {
  return POST(
    new Request("http://localhost/api/ics/refresh", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  refreshDue.mockReset();
  refreshDue.mockResolvedValue({ refreshed: 2, failed: 1 });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/ics/refresh", () => {
  it("answers 401 without the secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(refreshDue).not.toHaveBeenCalled();
  });

  it("refreshes what is due", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(await response.json()).toEqual({
      ok: true,
      refreshed: 2,
      failed: 1,
    });
    expect(refreshDue).toHaveBeenCalledWith(SECRET);
    expect(maxDuration).toBe(60);
  });

  it("answers 500 on an unexpected failure", async () => {
    refreshDue.mockRejectedValue(new Error("boom"));
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });
});
