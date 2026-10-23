// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T15: deleting the account needs the own email and the password, and
// nothing is deleted when they do not match (RF-16, RF-17, RF-19; plan D1).
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: "u1" } } }),
      getUser: h.getUser,
      signInWithPassword: h.signInWithPassword,
      signOut: h.signOut,
    },
    rpc: h.rpc,
  }),
}));

const { deleteAccount } =
  await import("@/app/dashboard/settings/account-actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  h.getUser.mockReset().mockResolvedValue({
    data: { user: { id: "u1", email: "ana@example.com" } },
    error: null,
  });
  h.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  h.signOut.mockReset().mockResolvedValue({ error: null });
  h.rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("deleteAccount (RF-16, RF-17, RF-19)", () => {
  it("with the own email and the right password, deletes the account, signs out and goes to login", async () => {
    await expect(
      deleteAccount(
        {},
        form({ email: " Ana@Example.com ", password: "actual-1234" }),
      ),
    ).rejects.toThrow("REDIRECT:/login");

    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "actual-1234",
    });
    expect(h.rpc).toHaveBeenCalledWith("delete_own_account");
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not delete anything when the email is not the account's (RF-17)", async () => {
    const state = await deleteAccount(
      {},
      form({ email: "otra@example.com", password: "actual-1234" }),
    );

    expect(h.rpc).not.toHaveBeenCalled();
    expect(state.formError).toBe("El email o la contraseña no coinciden.");
  });

  it("does not delete anything with a wrong password (RF-17)", async () => {
    h.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });

    const state = await deleteAccount(
      {},
      form({ email: "ana@example.com", password: "mala-1234" }),
    );

    expect(h.rpc).not.toHaveBeenCalled();
    expect(state.formError).toBe("El email o la contraseña no coinciden.");
  });

  it("does not delete anything with an empty field (RF-17)", async () => {
    const state = await deleteAccount(
      {},
      form({ email: "ana@example.com", password: "" }),
    );

    expect(h.signInWithPassword).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(state.formError).toBe("El email o la contraseña no coinciden.");
  });

  it("keeps the session and shows the connection message when the deletion fails", async () => {
    h.rpc.mockResolvedValue({
      data: null,
      error: new TypeError("fetch failed"),
    });

    const state = await deleteAccount(
      {},
      form({ email: "ana@example.com", password: "actual-1234" }),
    );

    expect(h.signOut).not.toHaveBeenCalled();
    expect(state.formError).toBe(
      "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  });
});
