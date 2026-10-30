// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Spec 012, T5: POST /api/images/purge, woken up by pg_cron (plan D7; RF-16 to
// RF-18). No session and no service role key: the secret opens the purge.
const { rpc, remove } = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc, storage: { from: () => ({ remove }) } }),
}));

import { maxDuration, POST } from "@/app/api/images/purge/route";

const SECRET = "test-cron-secret";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function call(authorization?: string) {
  return POST(
    new Request("http://localhost/api/images/purge", {
      method: "POST",
      headers: authorization ? { authorization } : undefined,
    }),
  );
}

function claims(...batches: string[][]) {
  rpc.mockImplementation(async (name: string) => {
    if (name === "images_claim_purge") {
      return { data: batches.shift() ?? [], error: null };
    }
    return { data: null, error: null };
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  rpc.mockReset();
  remove.mockReset();
  remove.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/images/purge", () => {
  it("answers 401 without the secret or with another one", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("removes both objects of each claimed image and confirms them", async () => {
    claims([A, B]);
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, removed: 2 });
    expect(rpc).toHaveBeenCalledWith(
      "images_claim_purge",
      expect.objectContaining({ p_secret: SECRET }),
    );
    expect(remove).toHaveBeenCalledWith([
      `${A}/full.jpg`,
      `${A}/thumb.jpg`,
      `${B}/full.jpg`,
      `${B}/thumb.jpg`,
    ]);
    expect(rpc).toHaveBeenCalledWith("images_done_purge", {
      p_secret: SECRET,
      p_object_ids: [A, B],
    });
  });

  it("does not confirm the objects Storage failed to remove", async () => {
    claims([A]);
    remove.mockResolvedValue({ data: null, error: new Error("down") });
    const response = await call(`Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, removed: 0 });
    expect(rpc).not.toHaveBeenCalledWith(
      "images_done_purge",
      expect.anything(),
    );
  });

  it("answers 500 when the claim fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await call(`Bearer ${SECRET}`)).status).toBe(500);
  });

  it("may run for 60 s", () => {
    expect(maxDuration).toBe(60);
  });
});
