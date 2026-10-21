// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ claims: null as object | null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getClaims: async () => ({ data: { claims: state.claims } }) },
  }),
}));

vi.mock("@/lib/supabase/env", () => ({
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
}));

const { updateSession } = await import("@/lib/supabase/proxy");

const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

describe("updateSession redirects (RF-7, plan R7)", () => {
  it("keeps the next query when sending an invite to /login", async () => {
    state.claims = null;
    const response = await updateSession(
      new NextRequest(`http://localhost/invite/${TOKEN}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `http://localhost/login?next=%2Finvite%2F${TOKEN}`,
    );
  });

  it("still drops the query of other redirects", async () => {
    state.claims = null;
    const response = await updateSession(
      new NextRequest("http://localhost/dashboard?x=1"),
    );

    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("lets a user with session open the invite", async () => {
    state.claims = { sub: "user" };
    const response = await updateSession(
      new NextRequest(`http://localhost/invite/${TOKEN}`),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });
});
