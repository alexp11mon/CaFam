// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";

// Spec 049, T2: an account still unconfirmed is told so and offered the link
// again (RF-3).
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: () => {}, delete: () => {} }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: null },
        error: { code: "email_not_confirmed", message: "Email not confirmed" },
      }),
    },
  }),
}));

const { signIn } = await import("@/app/(auth)/actions");

describe("signIn of an unconfirmed account (RF-3)", () => {
  it("says to confirm it and keeps the address for the resend", async () => {
    const data = new FormData();
    data.append("email", "ana@gmail.com");
    data.append("password", "12345678");
    expect(await signIn({ values: { email: "" } }, data)).toEqual({
      formError: AUTH_MESSAGES.unconfirmed,
      unconfirmed: true,
      values: { email: "ana@gmail.com" },
    });
    expect(AUTH_MESSAGES.unconfirmed).toBe(
      "Confirma tu email antes de entrar.",
    );
  });
});
