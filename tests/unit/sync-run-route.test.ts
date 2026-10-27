// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 007, T8: POST /api/sync/run, woken up by pg_cron (plan D2, D4; RF-22).
const { runDue } = vi.hoisted(() => ({ runDue: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc: vi.fn() }),
}));
vi.mock("@/lib/sync/run-sync", () => ({ runDue }));

import { maxDuration, POST } from "@/app/api/sync/run/route";

const SECRET = "test-cron-secret";

function call(authorization?: string) {
  return POST(
    new Request("http://localhost/api/sync/run", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  runDue.mockReset();
  runDue.mockResolvedValue(3);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/sync/run", () => {
  it("answers 401 without the secret or with another one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(runDue).not.toHaveBeenCalled();
  });

  it("runs what is due and says how many calendars", async () => {
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, calendars: 3 });
    expect(runDue).toHaveBeenCalledWith(
      expect.objectContaining({ secret: SECRET }),
    );
  });

  it("answers 500 on an unexpected failure", async () => {
    runDue.mockRejectedValue(new Error("boom"));
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(500);
  });

  it("may run for 60 s", () => {
    expect(maxDuration).toBe(60);
  });
});
