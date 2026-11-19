// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 043 T3: the public subscription route (RF-9, RF-10, RNF-3).
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

async function get(token: string) {
  const { GET } = await import("@/app/api/ics/[token]/route");
  return GET(new Request(`http://localhost/api/ics/${token}`), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({
    data: {
      name: "Familia",
      rows: [
        {
          id: "e1",
          title: "Cena",
          description: null,
          location: null,
          starts_at: "2026-11-20T19:00:00Z",
          ends_at: "2026-11-20T21:00:00Z",
          all_day: false,
          recurrence: null,
          recurrence_tz: null,
          exdates: null,
          series_id: null,
          original_start: null,
          created_at: "2026-11-01T00:00:00Z",
          updated_at: "2026-11-01T00:00:00Z",
        },
      ],
    },
    error: null,
  });
});

describe("GET /api/ics/[token]", () => {
  it("returns the calendar with its headers, dropping .ics from the token", async () => {
    const response = await get("abc.ics");
    expect(rpc).toHaveBeenCalledWith("ics_feed", { p_token: "abc" });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=900");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    const text = await response.text();
    expect(text).toContain("X-WR-CALNAME:Familia");
    expect(text).toContain("SUMMARY:Cena");
  });

  it("answers 404 without a body for a bad or revoked token", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "CF404" } });
    const response = await get("nope.ics");
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("answers 429 above the limit", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "CF429" } });
    expect((await get("abc.ics")).status).toBe(429);
  });
});
