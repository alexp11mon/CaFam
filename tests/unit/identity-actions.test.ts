// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 050, T3: link, unlink only with another way in, create a password,
// delete an account without one (RF-5, RF-6, RF-8).
const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  linkIdentity: vi.fn(),
  unlinkIdentity: vi.fn(),
  updateUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));
const rpc = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://cafam.test" }),
}));
vi.mock("@/lib/calendar/queries", () => ({
  requireActionUser: async () => ({ supabase: { auth, rpc }, userId: "me" }),
}));

const { createPassword, linkGoogle, unlinkGoogle } =
  await import("@/app/dashboard/settings/identity-actions");
const { IDENTITY_TEXTS } = await import("@/lib/account/identity-texts");
const { deleteAccount } =
  await import("@/app/dashboard/settings/account-actions");

const GOOGLE = { provider: "google", identity_data: { email: "a@gmail.com" } };
function as(identities: unknown[], metadata = {}) {
  auth.getUser.mockResolvedValue({
    data: {
      user: { email: "a@gmail.com", identities, user_metadata: metadata },
    },
  });
}
function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.unlinkIdentity.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ error: null });
});

describe("linkGoogle", () => {
  it("goes to Google and back to Ajustes", async () => {
    auth.linkIdentity.mockResolvedValue({
      data: { url: "https://accounts.google.com/x" },
      error: null,
    });
    await expect(linkGoogle()).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/x",
    );
    expect(auth.linkIdentity.mock.calls[0]![0].options.redirectTo).toBe(
      "https://cafam.test/auth/callback?next=%2Fdashboard%2Fsettings",
    );
  });
});

describe("unlinkGoogle", () => {
  it("never leaves the account without a way in", async () => {
    as([GOOGLE]);
    expect(await unlinkGoogle()).toEqual({
      formError: IDENTITY_TEXTS.needPassword,
    });
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it("unlinks when there is a password", async () => {
    as([{ provider: "email" }, GOOGLE]);
    expect(await unlinkGoogle()).toEqual({
      saved: IDENTITY_TEXTS.unlinked,
    });
    expect(auth.unlinkIdentity).toHaveBeenCalledWith(GOOGLE);
  });
});

describe("createPassword", () => {
  it("sets the first password and marks it", async () => {
    as([GOOGLE]);
    expect(await createPassword({}, form({ password: "nueva-1234" }))).toEqual({
      saved: IDENTITY_TEXTS.passwordCreated,
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "nueva-1234",
      data: { has_password: true },
    });
  });

  it("is not a way around the current password", async () => {
    as([{ provider: "email" }]);
    expect(await createPassword({}, form({ password: "nueva-1234" }))).toEqual({
      formError: IDENTITY_TEXTS.hasPassword,
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("deleteAccount of an account with only Google (RF-8)", () => {
  it("deletes it with the own email, without a password", async () => {
    as([GOOGLE]);
    await expect(
      deleteAccount({}, form({ email: "a@gmail.com" })),
    ).rejects.toThrow("REDIRECT:/login");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("delete_own_account");
  });

  it("refuses another email", async () => {
    as([GOOGLE]);
    expect(
      (await deleteAccount({}, form({ email: "b@gmail.com" }))).formError,
    ).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});
