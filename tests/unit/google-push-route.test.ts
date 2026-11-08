// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushHeaders } from "@/lib/sync/channel";

// Spec 020, T11: POST /api/sync/google-push, Google's notices (plan D10,
// "Contratos"; RF-19, RF-21, RF-24).
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

import { POST } from "@/app/api/sync/google-push/route";

const SECRET = "test-cron-secret";
const VALID = {
  "x-goog-channel-id": "ch-1",
  "x-goog-channel-token": "tok-1",
  "x-goog-resource-state": "exists",
  "x-goog-resource-id": "res-1",
};

function notice(headers: Record<string, string> = VALID) {
  const body = { read: false };
  const request = new Request("http://localhost/api/sync/google-push", {
    method: "POST",
    headers,
    body: "ignored",
  });
  // Spies on the body: the route must not read it.
  for (const m of ["text", "json", "arrayBuffer", "formData"] as const) {
    Object.defineProperty(request, m, {
      value: () => {
        body.read = true;
        return Promise.reject(new Error("read"));
      },
    });
  }
  return { request, body };
}

async function shape(response: Response) {
  return { status: response.status, body: await response.text() };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pushHeaders", () => {
  it("reads the channel, the token and the state", () => {
    expect(pushHeaders(new Headers(VALID))).toEqual({
      channelId: "ch-1",
      token: "tok-1",
      state: "exists",
    });
  });

  it("is null without the channel or the token", () => {
    expect(pushHeaders(new Headers({}))).toBeNull();
    expect(
      pushHeaders(new Headers({ "x-goog-channel-id": "ch-1" })),
    ).toBeNull();
    expect(
      pushHeaders(new Headers({ "x-goog-channel-token": "tok-1" })),
    ).toBeNull();
  });
});

describe("POST /api/sync/google-push", () => {
  it("passes a valid notice to sync_push and answers 200 without a body", async () => {
    const { request, body } = notice();
    const response = await shape(await POST(request));

    expect(response).toEqual({ status: 200, body: "" });
    expect(rpc).toHaveBeenCalledWith("sync_push", {
      p_secret: SECRET,
      p_channel_id: "ch-1",
      p_token: "tok-1",
      p_state: "exists",
    });
    expect(body.read).toBe(false);
  });

  it("answers the same without headers, and does not call the database", async () => {
    const { request } = notice({});
    expect(await shape(await POST(request))).toEqual({ status: 200, body: "" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers exactly like a valid notice to a false token or a database error (RF-21)", async () => {
    const valid = await shape(await POST(notice().request));
    const fake = await shape(
      await POST(
        notice({ ...VALID, "x-goog-channel-token": "tok-false" }).request,
      ),
    );
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    const failing = await shape(await POST(notice().request));
    rpc.mockRejectedValueOnce(new Error("network"));
    const thrown = await shape(await POST(notice().request));

    expect(fake).toEqual(valid);
    expect(failing).toEqual(valid);
    expect(thrown).toEqual(valid);
  });

  it("does nothing without CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(await shape(await POST(notice().request))).toEqual({
      status: 200,
      body: "",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
