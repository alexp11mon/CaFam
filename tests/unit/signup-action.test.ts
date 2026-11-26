// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";

// Spec 049, T2: with "Confirm email" on, signing up has no session and waits
// for the link; "Reenviar" is limited (RF-1, RF-5).
const TOKEN = "abcDEF123-_abcDEF123-_abcDEF123-_abcDEF123-_";
const jar = new Map<string, string>();
const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
}));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "accept-language": "es-ES" }),
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, rpc }),
}));

const { signUp, resendConfirmation } = await import("@/app/(auth)/actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const SIGN_UP = {
  email: "ana@gmail.com",
  password: "12345678",
  displayName: "Ana",
  timeZone: "Europe/Madrid",
};
const empty = { values: { displayName: "", email: "" } };

beforeEach(() => {
  jar.clear();
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  auth.resend.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("signUp without a session (RF-1, RF-5)", () => {
  it("goes to the check screen with the address masked, and keeps it in a cookie", async () => {
    await expect(
      signUp(empty, form({ ...SIGN_UP, next: `/invite/${TOKEN}` })),
    ).rejects.toThrow("REDIRECT:/signup/check-email?email=a***%40gmail.com");
    expect(readPending(jar.get(PENDING_COOKIE))).toEqual({
      email: "ana@gmail.com",
      next: `/invite/${TOKEN}`,
    });
  });

  it("still enters at once while confirmation is off", async () => {
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    await expect(signUp(empty, form(SIGN_UP))).rejects.toThrow(
      "REDIRECT:/dashboard/calendar",
    );
    expect(jar.has(PENDING_COOKIE)).toBe(false);
  });
});

// Spec 053 RF-7: the profile and "Mi calendario" take the sign-up language.
describe("signUp and the language", () => {
  it("sends the language of the cookie, else of the browser", async () => {
    await expect(signUp(empty, form(SIGN_UP))).rejects.toThrow("REDIRECT");
    expect(auth.signUp.mock.lastCall?.[0].options.data.locale).toBe("es");
    jar.set("cafam-locale", "en");
    await expect(signUp(empty, form(SIGN_UP))).rejects.toThrow("REDIRECT");
    expect(auth.signUp.mock.lastCall?.[0].options.data.locale).toBe("en");
  });
});

describe("resendConfirmation (RF-1, RF-3)", () => {
  it("sends to the address of the cookie, within the limit", async () => {
    jar.set(
      PENDING_COOKIE,
      JSON.stringify({ email: "ana@gmail.com", next: "/" }),
    );
    expect(await resendConfirmation({}, form({}))).toEqual({ status: "sent" });
    expect(rpc).toHaveBeenCalledWith("request_signup_resend", {
      p_email: "ana@gmail.com",
    });
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ana@gmail.com",
    });
  });

  it("sends nothing past the limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(
      await resendConfirmation({}, form({ email: "ana@gmail.com" })),
    ).toEqual({ status: "limited" });
    expect(auth.resend).not.toHaveBeenCalled();
  });

  it("asks for an address when it has none", async () => {
    const state = await resendConfirmation({}, form({}));
    expect(state.formError).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
