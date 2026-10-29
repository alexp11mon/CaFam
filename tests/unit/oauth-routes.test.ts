// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@/lib/sync/providers/google";
import { CONNECT_ERRORS } from "@/lib/sync/error-messages";

// Spec 007, T7: OAuth start and callback (plan D10; RF-1, RF-3, RF-4, RF-5,
// RF-32, RF-47).
const { getClaims, rpc, exchangeCode } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  rpc: vi.fn(),
  exchangeCode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims }, rpc }),
}));

vi.mock("@/lib/sync/providers/google", async (original) => ({
  ...(await original<object>()),
  exchangeCode,
}));

import { GET as start } from "@/app/api/oauth/[provider]/start/route";
import { GET as callback } from "@/app/api/oauth/[provider]/callback/route";

const ORIGIN = "https://calenderfam.test";
const context = (provider = "google") => ({
  params: Promise.resolve({ provider }),
});

function location(response: Response) {
  const url = new URL(response.headers.get("location") ?? "", ORIGIN);
  return url.origin === ORIGIN ? url.pathname + url.search : url.toString();
}

async function begin() {
  const response = await start(
    new Request(`${ORIGIN}/api/oauth/google/start`),
    context(),
  );
  const cookie = response.headers.get("set-cookie") ?? "";
  const state = new URL(
    response.headers.get("location") ?? "",
  ).searchParams.get("state");
  return { response, cookie, state, pair: cookie.split(";")[0] };
}

function back(query: string, cookie?: string) {
  return callback(
    new Request(`${ORIGIN}/api/oauth/google/callback?${query}`, {
      headers: cookie ? { cookie } : undefined,
    }),
    context(),
  );
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  rpc.mockResolvedValue({
    data: { id: "conn-1", existed: false },
    error: null,
  });
  exchangeCode.mockResolvedValue({
    accessToken: "at",
    refreshToken: "rt",
    subject: "sub-1",
    email: "ana@gmail.com",
    scope:
      "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("start (RF-1)", () => {
  it("sends a user without a session to /login", async () => {
    getClaims.mockResolvedValue({ data: null });
    const { response } = await begin();
    expect(location(response)).toBe("/login");
  });

  it("answers 404 for an unknown provider", async () => {
    const response = await start(
      new Request(`${ORIGIN}/api/oauth/microsoft/start`),
      context("microsoft"),
    );
    expect(response.status).toBe(404);
  });

  it("redirects to Google and keeps state and PKCE in a short httpOnly cookie", async () => {
    const { response, cookie, state } = await begin();

    expect(response.status).toBe(307);
    const url = new URL(response.headers.get("location") ?? "");
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/api/oauth/google/callback`,
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(state).toMatch(/^[\w-]{40,}$/);

    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=600/);
  });
});

describe("callback (RF-3 to RF-5, RF-32, RF-47)", () => {
  it("does not connect without the cookie or with another state", async () => {
    const { pair } = await begin();

    const noCookie = await back("code=c&state=x");
    const otherState = await back("code=c&state=other", pair);

    expect(location(noCookie)).toBe("/dashboard/connections?error=failed");
    expect(location(otherState)).toBe("/dashboard/connections?error=failed");
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("comes back with cancelled when the user refuses (RF-4, RF-47)", async () => {
    const { pair, state } = await begin();

    const response = await back(`error=access_denied&state=${state}`, pair);

    expect(location(response)).toBe("/dashboard/connections?error=cancelled");
    expect(CONNECT_ERRORS.cancelled).toMatch(/plazas/);
  });

  it("comes back with failed when Google fails (RF-5)", async () => {
    const { pair, state } = await begin();
    exchangeCode.mockRejectedValue(new ProviderError("transient", "down"));

    const response = await back(`code=c&state=${state}`, pair);

    expect(location(response)).toBe("/dashboard/connections?error=failed");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("comes back with max at the sixth account (RF-8)", async () => {
    const { pair, state } = await begin();
    rpc.mockResolvedValue({ data: null, error: { code: "CF429" } });

    const response = await back(`code=c&state=${state}`, pair);

    expect(location(response)).toBe("/dashboard/connections?error=max");
  });

  it("connects and opens the account page, also for a repeated account (RF-3, RF-32)", async () => {
    const { pair, state } = await begin();
    rpc.mockResolvedValue({
      data: { id: "conn-1", existed: true },
      error: null,
    });

    const response = await back(`code=the-code&state=${state}`, pair);

    expect(location(response)).toBe("/dashboard/connections/conn-1");
    expect(exchangeCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "the-code",
        redirectUri: `${ORIGIN}/api/oauth/google/callback`,
        codeVerifier: expect.stringMatching(/^[\w-]{43,}$/),
      }),
    );
    expect(rpc).toHaveBeenCalledWith("connect_account", {
      p_provider: "google",
      p_subject: "sub-1",
      p_email: "ana@gmail.com",
      p_refresh_token: "rt",
      // Every permission granted: the account writes (spec 009 RF-1, RF-4).
      p_can_write: true,
    });
    // The state cookie is used once.
    expect(response.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("keeps the account read-only and says what is missing (spec 009 RF-5)", async () => {
    const { pair, state } = await begin();
    exchangeCode.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      subject: "sub-1",
      email: "ana@gmail.com",
      scope:
        "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    });

    const response = await back(`code=the-code&state=${state}`, pair);

    expect(location(response)).toBe(
      "/dashboard/connections/conn-1?missing=calendar.events,calendar.calendars",
    );
    expect(rpc).toHaveBeenCalledWith(
      "connect_account",
      expect.objectContaining({ p_can_write: false }),
    );
  });
});
