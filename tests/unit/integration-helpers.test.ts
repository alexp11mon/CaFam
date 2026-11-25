// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { timedFetch, withRetry } from "../integration/net";

// Spec 051, T4: test:db fails clearly instead of hanging, and retries only
// network and rate-limit errors of user management (RF-10, RF-11).
describe("timedFetch", () => {
  it("turns a hang into a clear failure (RF-10)", async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal!.reason),
        ),
      );
    await expect(
      timedFetch(hang, 30)("https://dev.supabase.co/auth/v1/admin/users"),
    ).rejects.toThrow(
      "Supabase dev no respondió en 0.03 s: https://dev.supabase.co/auth/v1/admin/users",
    );
  });

  it("passes answers and other errors through", async () => {
    const ok = vi.fn(async () => new Response("ok"));
    expect(await (await timedFetch(ok, 1000)("https://x.test")).text()).toBe(
      "ok",
    );
    const broken: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(timedFetch(broken, 1000)("https://x.test")).rejects.toThrow(
      "fetch failed",
    );
  });
});

describe("withRetry (RF-11)", () => {
  const limited = {
    error: { status: 429, message: "Request rate limit reached" },
  };

  it("retries a rate limit twice, waiting 2 and 5 s", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi
      .fn()
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce(limited)
      .mockResolvedValueOnce({ data: 1, error: null });
    expect(await withRetry(call, sleep)).toEqual({ data: 1, error: null });
    expect(call).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[2000], [5000]]);
  });

  it("retries network errors, thrown or returned, and gives up after two", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue({
        error: { name: "AuthRetryableFetchError", message: "fetch failed" },
      });
    expect((await withRetry(call, sleep)).error).toMatchObject({
      name: "AuthRetryableFetchError",
    });
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("never retries any other error", async () => {
    const sleep = vi.fn(async () => {});
    const call = vi
      .fn()
      .mockResolvedValue({ error: { status: 422, message: "Email exists" } });
    await withRetry(call, sleep);
    expect(call).toHaveBeenCalledOnce();
    const thrown = vi.fn().mockRejectedValue(new Error("expected 1 to be 2"));
    await expect(withRetry(thrown, sleep)).rejects.toThrow(
      "expected 1 to be 2",
    );
    expect(thrown).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });
});
