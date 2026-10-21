// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ limit }) }),
  }),
}));

const SECRET = "test-cron-secret";

async function callRoute(authorization?: string) {
  const { GET } = await import("@/app/api/cron/keep-alive/route");
  const headers = authorization ? { authorization } : undefined;
  return GET(new Request("http://localhost/api/cron/keep-alive", { headers }));
}

describe("GET /api/cron/keep-alive (RF-25)", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRET);
    limit.mockReset();
    limit.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 without an Authorization header", async () => {
    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(limit).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong secret", async () => {
    const response = await callRoute("Bearer wrong-secret");

    expect(response.status).toBe(401);
    expect(limit).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await callRoute("Bearer ");

    expect(response.status).toBe(401);
  });

  it("queries Supabase and returns 200 with the right secret", async () => {
    const response = await callRoute(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns 500 when Supabase fails, so the cron run shows the error", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "paused" } });

    const response = await callRoute(`Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false });
  });
});
