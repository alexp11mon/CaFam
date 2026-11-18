// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 035 T8: the two routes of the service worker (plan D5, RF-39 to
// RF-44). The work is shared with the Server Action and tested there.

const getClaims = vi.fn();
const applyChange = vi.fn();
const offlineImage = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/lib/calendar/queries", () => ({
  getProfileTimeZone: async () => "Europe/Madrid",
}));
vi.mock("@/app/dashboard/offline-writes", () => ({ applyChange }));
vi.mock("@/app/dashboard/offline-images", async (original) => ({
  ...(await original<typeof import("@/app/dashboard/offline-images")>()),
  offlineImage,
}));

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const CHANGE = {
  type: "comment.add",
  eventId: "3f0b0d4e-7c2a-4b8e-9a51-2f6c1d0e9b11",
  clientId: "8c1f4b9a-2d3e-4f5a-9b6c-7d8e9f0a1b2c",
  body: "Llevo el postre",
};

beforeEach(() => {
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  applyChange.mockReset();
  offlineImage.mockReset();
});

describe("POST /api/offline/apply", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/offline/apply/route");
    return POST(post(body));
  };

  it("answers 401 without a session (RF-44)", async () => {
    getClaims.mockResolvedValue({ data: null });
    const response = await call({ change: CHANGE });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ unauthenticated: true });
    expect(applyChange).not.toHaveBeenCalled();
  });

  it("an invalid change is rejected without touching anything", async () => {
    const response = await call({ change: { type: "nope" } });
    expect(await response.json()).toEqual({
      status: "rejected",
      reason: expect.stringMatching(/no es válido/),
    });
    expect((await call("{not json")).status).toBe(200);
    expect(applyChange).not.toHaveBeenCalled();
  });

  it("gives the same result as the Server Action, with force", async () => {
    applyChange.mockResolvedValue({ status: "held", connectionId: "c1" });
    const response = await call({ change: CHANGE, force: true });
    expect(await response.json()).toEqual({
      status: "held",
      connectionId: "c1",
    });
    expect(applyChange).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "Europe/Madrid",
      CHANGE,
      true,
    );
  });
});

describe("POST /api/offline/image", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/offline/image/route");
    return POST(post(body));
  };
  const RESERVE = {
    op: "reserve",
    eventId: CHANGE.eventId,
    image: { bytes: 1000, width: 100, height: 80 },
  };

  it("answers 401 without a session and 400 for a wrong body", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect((await call(RESERVE)).status).toBe(401);
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    expect((await call({ op: "reserve", eventId: "x" })).status).toBe(400);
    expect(offlineImage).not.toHaveBeenCalled();
  });

  it("passes the answer through with its status", async () => {
    offlineImage.mockResolvedValue({
      status: 429,
      body: { error: "Este evento ya tiene 10 imágenes." },
    });
    const response = await call(RESERVE);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "Este evento ya tiene 10 imágenes.",
    });
  });

  it("a failure of Supabase is 503: the client tries again", async () => {
    offlineImage.mockRejectedValue(new Error("fetch failed"));
    expect((await call({ op: "confirm", id: CHANGE.clientId })).status).toBe(
      503,
    );
  });
});
