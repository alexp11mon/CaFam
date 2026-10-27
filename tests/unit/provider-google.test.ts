// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  authorizationUrl,
  exchangeCode,
  GOOGLE_SCOPES,
  listCalendars,
  listEvents,
  ProviderError,
  refreshAccessToken,
  revokeToken,
} from "@/lib/sync/providers/google";

// Spec 007, T6: Google client with a fake fetch (plan D8 to D10; RF-1, RF-2,
// RF-9, RF-12, RF-15, RF-16, RF-30).
const CLIENT = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/oauth/google/callback",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function idToken(claims: object) {
  const part = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

function fakeFetch(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  return fn;
}

function calledUrl(fn: ReturnType<typeof fakeFetch>, call = 0) {
  return new URL(String(fn.mock.calls[call][0]));
}

describe("authorizationUrl (RF-1, RF-2)", () => {
  const url = new URL(
    authorizationUrl({ ...CLIENT, state: "st", codeChallenge: "ch" }),
  );

  it("asks only the read-only scopes of the plan", () => {
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPES);
    expect(GOOGLE_SCOPES).toBe(
      "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly",
    );
  });

  it("carries state, PKCE S256 and offline access", () => {
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client-id",
      redirect_uri: CLIENT.redirectUri,
      response_type: "code",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
  });
});

describe("exchangeCode and refreshAccessToken", () => {
  it("returns the tokens and the email and sub of the id_token", async () => {
    const fn = fakeFetch(
      json({
        access_token: "at",
        refresh_token: "rt",
        id_token: idToken({ sub: "123", email: "ana@gmail.com" }),
      }),
    );

    const result = await exchangeCode(
      { ...CLIENT, code: "code", codeVerifier: "verifier" },
      fn,
    );

    expect(result).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      subject: "123",
      email: "ana@gmail.com",
    });
    expect(String(fn.mock.calls[0][0])).toBe(
      "https://oauth2.googleapis.com/token",
    );
    const body = new URLSearchParams(String(fn.mock.calls[0][1]?.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "code",
      code_verifier: "verifier",
      client_id: "client-id",
      client_secret: "client-secret",
      redirect_uri: CLIENT.redirectUri,
    });
  });

  it("fails when Google sends no refresh token", async () => {
    const fn = fakeFetch(
      json({ access_token: "at", id_token: idToken({ sub: "1", email: "a" }) }),
    );
    await expect(
      exchangeCode({ ...CLIENT, code: "c", codeVerifier: "v" }, fn),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("renews the access token and passes a new refresh token on", async () => {
    const fn = fakeFetch(
      json({ access_token: "at2" }),
      json({ access_token: "at3", refresh_token: "rt-new" }),
    );

    expect(
      await refreshAccessToken({ ...CLIENT, refreshToken: "rt" }, fn),
    ).toEqual({ accessToken: "at2", refreshToken: null });
    expect(
      await refreshAccessToken({ ...CLIENT, refreshToken: "rt" }, fn),
    ).toEqual({ accessToken: "at3", refreshToken: "rt-new" });
    const body = new URLSearchParams(String(fn.mock.calls[0][1]?.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
  });

  it("classifies invalid_grant as revoked", async () => {
    const fn = fakeFetch(json({ error: "invalid_grant" }, 400));
    await expect(
      refreshAccessToken({ ...CLIENT, refreshToken: "rt" }, fn),
    ).rejects.toMatchObject({ kind: "revoked" });
  });
});

describe("listCalendars (RF-9, RF-12)", () => {
  it("reads every page with the name and color", async () => {
    const fn = fakeFetch(
      json({
        items: [
          { id: "primary@x", summary: "Ana", backgroundColor: "#9fe1e7" },
        ],
        nextPageToken: "p2",
      }),
      json({
        items: [
          {
            id: "fam@group",
            summary: "Familia",
            summaryOverride: "Mi familia",
            backgroundColor: "#f83a22",
          },
        ],
      }),
    );

    expect(await listCalendars("at", fn)).toEqual([
      { id: "primary@x", name: "Ana", color: "#9fe1e7" },
      { id: "fam@group", name: "Mi familia", color: "#f83a22" },
    ]);
    expect(fn.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer at",
    });
    expect(calledUrl(fn, 1).searchParams.get("pageToken")).toBe("p2");
  });
});

describe("listEvents (RF-15, RF-16)", () => {
  const range = {
    from: new Date("2026-04-27T00:00:00Z"),
    to: new Date("2027-10-27T00:00:00Z"),
  };

  it("expands repetitions in the window and follows pages", async () => {
    const fn = fakeFetch(
      json({ items: [{ id: "a" }], nextPageToken: "p2" }),
      json({ items: [{ id: "b" }] }),
    );

    const events = await listEvents("at", "fam@group", range, fn);

    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    const url = calledUrl(fn);
    expect(url.pathname).toBe("/calendar/v3/calendars/fam%40group/events");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      singleEvents: "true",
      timeMin: "2026-04-27T00:00:00.000Z",
      timeMax: "2027-10-27T00:00:00.000Z",
    });
  });

  it("stops at 10,000 events", async () => {
    const page = (n: number) =>
      json({
        items: Array.from({ length: 2500 }, (_, i) => ({ id: `${n}-${i}` })),
        nextPageToken: `p${n + 1}`,
      });
    const fn = fakeFetch(page(1), page(2), page(3), page(4), page(5));

    const events = await listEvents("at", "big", range, fn);

    expect(events).toHaveLength(10_000);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it.each([
    [404, "missing"],
    [410, "missing"],
    [401, "revoked"],
    [429, "transient"],
    [500, "transient"],
    [503, "transient"],
  ])("classifies %i as %s", async (status, kind) => {
    const fn = fakeFetch(json({ error: { code: status } }, status));
    await expect(listEvents("at", "x", range, fn)).rejects.toMatchObject({
      kind,
    });
  });

  it("classifies a network failure as transient", async () => {
    const fn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fail"));
    await expect(listEvents("at", "x", range, fn)).rejects.toMatchObject({
      kind: "transient",
    });
  });
});

describe("revokeToken (RF-30)", () => {
  it("calls Google's revocation endpoint", async () => {
    const fn = fakeFetch(new Response(null, { status: 200 }));

    await revokeToken("rt", fn);

    expect(String(fn.mock.calls[0][0])).toBe(
      "https://oauth2.googleapis.com/revoke",
    );
    expect(String(fn.mock.calls[0][1]?.body)).toBe("token=rt");
  });
});
