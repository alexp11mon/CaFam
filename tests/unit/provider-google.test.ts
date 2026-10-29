// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  authorizationUrl,
  deleteCalendar,
  deleteEvent,
  exchangeCode,
  insertCalendar,
  insertEvent,
  listCalendars,
  listEvents,
  moveEvent,
  patchCalendar,
  patchEvent,
  ProviderError,
  refreshAccessToken,
  revokeToken,
} from "@/lib/sync/providers/google";
import { GOOGLE_SCOPES } from "@/lib/sync/scopes";

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

  it("asks exactly the scopes of spec 009 D1", () => {
    expect(url.searchParams.get("scope")).toBe(GOOGLE_SCOPES);
    expect(GOOGLE_SCOPES).toBe(
      "openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars",
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
        scope: "openid email",
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
      // Granted permissions (spec 009 RF-5).
      scope: "openid email",
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
      { id: "primary@x", name: "Ana", color: "#9fe1e7", access: null },
      { id: "fam@group", name: "Mi familia", color: "#f83a22", access: null },
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
      json({ items: [{ id: "a" }], nextPageToken: "p2", accessRole: "writer" }),
      json({ items: [{ id: "b" }], accessRole: "writer" }),
    );

    const { events, accessRole } = await listEvents(
      "at",
      "fam@group",
      range,
      fn,
    );

    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    // The permission of the account over the calendar (spec 009 RF-8, D10).
    expect(accessRole).toBe("writer");
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

    const { events, accessRole } = await listEvents("at", "big", range, fn);

    expect(events).toHaveLength(10_000);
    expect(accessRole).toBeNull();
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

// Spec 009, T6: writing in Google (plan "Contratos", D6, D8; RF-8, RF-10 to
// RF-13, RF-15, RF-17, RF-19, RF-22 to RF-24, RF-29, RF-31, RF-32, RF-34).
describe("writes", () => {
  const API = "https://www.googleapis.com/calendar/v3";
  const request = (fn: ReturnType<typeof fakeFetch>, call = 0) => {
    const [url, init] = fn.mock.calls[call];
    return {
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: new Headers(init?.headers),
    };
  };

  it("insertEvent posts the body and returns the id", async () => {
    const fn = fakeFetch(json({ id: "g1" }));
    const id = await insertEvent("at", "fam@group", { summary: "A" }, fn);
    expect(id).toBe("g1");
    const r = request(fn);
    expect(r.url).toBe(`${API}/calendars/fam%40group/events`);
    expect(r.method).toBe("POST");
    expect(r.body).toEqual({ summary: "A" });
    expect(r.headers.get("authorization")).toBe("Bearer at");
    expect(r.headers.get("if-match")).toBeNull();
  });

  it("patchEvent sends only the patch to the instance id (RF-17)", async () => {
    const fn = fakeFetch(json({ id: "rec_20261102" }));
    await patchEvent("at", "c", "rec_20261102", { summary: "B" }, fn);
    const r = request(fn);
    expect(r.url).toBe(`${API}/calendars/c/events/rec_20261102`);
    expect(r.method).toBe("PATCH");
    expect(r.body).toEqual({ summary: "B" });
    expect(r.headers.get("if-match")).toBeNull();
  });

  it("an empty patch does not call Google", async () => {
    const fn = fakeFetch();
    await patchEvent("at", "c", "e", {}, fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it("moveEvent uses the move endpoint with the destination", async () => {
    const fn = fakeFetch(json({ id: "e" }));
    await moveEvent("at", "a@group", "e", "b@group", fn);
    const r = request(fn);
    expect(r.method).toBe("POST");
    expect(r.url).toBe(
      `${API}/calendars/a%40group/events/e/move?destination=b%40group`,
    );
  });

  it("deleteEvent deletes", async () => {
    const fn = fakeFetch(new Response(null, { status: 204 }));
    await deleteEvent("at", "c", "e", fn);
    expect(request(fn)).toMatchObject({
      url: `${API}/calendars/c/events/e`,
      method: "DELETE",
    });
  });

  it("insertCalendar, patchCalendar (only summary) and deleteCalendar", async () => {
    const fn = fakeFetch(
      json({ id: "new@group" }),
      json({ id: "new@group" }),
      new Response(null, { status: 204 }),
    );
    expect(
      await insertCalendar(
        "at",
        { summary: "Casa", timeZone: "Europe/Madrid" },
        fn,
      ),
    ).toBe("new@group");
    await patchCalendar("at", "new@group", "Hogar", fn);
    await deleteCalendar("at", "new@group", fn);
    expect(request(fn, 0)).toMatchObject({
      url: `${API}/calendars`,
      method: "POST",
      body: { summary: "Casa", timeZone: "Europe/Madrid" },
    });
    expect(request(fn, 1)).toMatchObject({
      url: `${API}/calendars/new%40group`,
      method: "PATCH",
      body: { summary: "Hogar" },
    });
    expect(request(fn, 2)).toMatchObject({
      url: `${API}/calendars/new%40group`,
      method: "DELETE",
    });
  });

  const apiError = (status: number, reason?: string) =>
    json(
      { error: { code: status, errors: reason ? [{ reason }] : [] } },
      status,
    );

  it.each([
    [apiError(401), "revoked"],
    [json({ error: "invalid_grant" }, 400), "revoked"],
    [apiError(404), "missing"],
    [apiError(410), "missing"],
    [apiError(403, "rateLimitExceeded"), "transient"],
    [apiError(403, "userRateLimitExceeded"), "transient"],
    [apiError(429), "transient"],
    [apiError(403, "forbidden"), "rejected"],
    [apiError(403, "requiredAccessLevel"), "rejected"],
    [apiError(400, "invalid"), "rejected"],
    [apiError(500), "transient"],
  ])("classifies %#", async (response, kind) => {
    const fn = fakeFetch(response);
    await expect(
      insertEvent("at", "c", { summary: "A" }, fn),
    ).rejects.toMatchObject({ kind });
  });
});

describe("listCalendars access (spec 009 RF-8)", () => {
  it("returns the access of the account over each calendar", async () => {
    const fn = fakeFetch(
      json({
        items: [
          { id: "a", summary: "A", accessRole: "owner" },
          { id: "b", summary: "B", accessRole: "freeBusyReader" },
        ],
      }),
    );
    const calendars = await listCalendars("at", fn);
    expect(calendars.map((c) => c.access)).toEqual(["owner", "reader"]);
  });
});
