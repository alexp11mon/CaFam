// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 043 T2: the export route (RF-1, RF-2): session, target and headers.
const getClaims = vi.fn();
const exportIcs = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/lib/ics/export-queries", () => ({ exportIcs }));

async function get(query: string) {
  const { GET } = await import("@/app/api/ics/export/route");
  return GET(new Request(`http://localhost/api/ics/export${query}`));
}

beforeEach(() => {
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
  exportIcs.mockReset();
  exportIcs.mockResolvedValue({
    filename: "Año escolar.ics",
    text: "BEGIN:VCALENDAR\r\n",
  });
});

describe("GET /api/ics/export", () => {
  it("answers 401 without a session", async () => {
    getClaims.mockResolvedValue({ data: null });
    expect((await get("?calendar=x")).status).toBe(401);
    expect(exportIcs).not.toHaveBeenCalled();
  });

  it("downloads one calendar", async () => {
    const response = await get("?calendar=cal-1");
    expect(response.status).toBe(200);
    expect(exportIcs.mock.calls[0]?.[1]).toBe("user-1");
    expect(exportIcs.mock.calls[0]?.[2]).toEqual({ calendarId: "cal-1" });
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="A_o escolar.ics"; filename*=UTF-8''A%C3%B1o%20escolar.ics`,
    );
    expect(await response.text()).toBe("BEGIN:VCALENDAR\r\n");
  });

  it("downloads the visible calendars", async () => {
    await get("?visible=1");
    expect(exportIcs.mock.calls[0]?.[2]).toEqual({ visible: true });
  });

  it("answers 404 for a calendar it cannot see or no target", async () => {
    exportIcs.mockResolvedValue(null);
    expect((await get("?calendar=other")).status).toBe(404);
    expect((await get("")).status).toBe(404);
  });
});
