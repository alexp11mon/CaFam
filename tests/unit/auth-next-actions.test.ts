// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";

// redirect() throws in Next to stop rendering; do the same so the code after it never runs.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ data: { session: {} }, error: null }),
    },
  }),
}));

const { signIn, signUp } = await import("@/app/(auth)/actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const SIGN_IN = { email: "ana@example.com", password: "12345678" };
const SIGN_UP = {
  ...SIGN_IN,
  displayName: "Ana",
  timeZone: "Europe/Madrid",
};

const signInState = { values: { email: "" } };
const signUpState = { values: { displayName: "", email: "" } };

describe("signIn and signUp redirect (RF-7)", () => {
  it.each([
    ["signIn", (data: FormData) => signIn(signInState, data), SIGN_IN],
    ["signUp", (data: FormData) => signUp(signUpState, data), SIGN_UP],
  ] as const)("%s goes back to a valid next", async (_name, run, fields) => {
    await expect(
      run(form({ ...fields, next: `/invite/${TOKEN}` })),
    ).rejects.toThrow(`REDIRECT:/invite/${TOKEN}`);
  });

  it.each([
    ["signIn", (data: FormData) => signIn(signInState, data), SIGN_IN],
    ["signUp", (data: FormData) => signUp(signUpState, data), SIGN_UP],
  ] as const)(
    "%s goes to /dashboard without next or with an invalid one",
    async (_name, run, fields) => {
      await expect(run(form(fields))).rejects.toThrow("REDIRECT:/dashboard");
      for (const next of [
        "",
        "/dashboard/calendar",
        "https://evil.example.com",
      ]) {
        await expect(run(form({ ...fields, next }))).rejects.toThrow(
          "REDIRECT:/dashboard",
        );
      }
    },
  );
});
