// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T14: asking for an email change checks the password and leaves the
// change pending until the new address confirms it (RF-6 to RF-10).
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
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
      updateUser: h.updateUser,
    },
  }),
}));

const { requestEmailChange } =
  await import("@/app/dashboard/settings/account-actions");
const { getAccountEmails } = await import("@/lib/account/queries");

const STATE = { values: { newEmail: "" } };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  h.revalidatePath.mockReset();
  h.getUser.mockReset().mockResolvedValue({
    data: { user: { id: "u1", email: "ana@example.com", new_email: null } },
    error: null,
  });
  h.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  h.updateUser.mockReset().mockResolvedValue({ error: null });
});

describe("requestEmailChange (RF-6 to RF-9)", () => {
  it("checks the current password and asks Auth for the change (RF-6, RF-9)", async () => {
    const state = await requestEmailChange(
      STATE,
      form({
        newEmail: " Ana.Nueva@Example.com ",
        currentPassword: "actual-1234",
      }),
    );

    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "actual-1234",
    });
    expect(h.updateUser).toHaveBeenCalledWith({
      email: "ana.nueva@example.com",
    });
    expect(state.pendingEmail).toBe("ana.nueva@example.com");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("does not start the change with a wrong current password (RF-7)", async () => {
    h.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });

    const state = await requestEmailChange(
      STATE,
      form({ newEmail: "nueva@example.com", currentPassword: "mala-1234" }),
    );

    expect(h.updateUser).not.toHaveBeenCalled();
    expect(state.fieldErrors?.currentPassword).toBe(
      "La contraseña actual no es correcta.",
    );
  });

  it("rejects an address that is not valid (RF-8)", async () => {
    const state = await requestEmailChange(
      STATE,
      form({ newEmail: "no-es-email", currentPassword: "actual-1234" }),
    );

    expect(h.updateUser).not.toHaveBeenCalled();
    expect(state.fieldErrors?.newEmail).toBe("Introduce un email válido.");
  });

  it("rejects the address it already has", async () => {
    const state = await requestEmailChange(
      STATE,
      form({ newEmail: "ana@example.com", currentPassword: "actual-1234" }),
    );

    expect(h.updateUser).not.toHaveBeenCalled();
    expect(state.fieldErrors?.newEmail).toBe("Esa ya es tu dirección actual.");
  });

  it("says when another account already uses the address (RF-8)", async () => {
    h.updateUser.mockResolvedValue({ error: { code: "email_exists" } });

    const state = await requestEmailChange(
      STATE,
      form({ newEmail: "otra@example.com", currentPassword: "actual-1234" }),
    );

    expect(state.pendingEmail).toBeUndefined();
    expect(state.fieldErrors?.newEmail).toBe(
      "Esa dirección ya la usa otra cuenta.",
    );
  });
});

describe("getAccountEmails (RF-10)", () => {
  it("returns the current address and the pending one", async () => {
    h.getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "ana@example.com",
          new_email: "ana.nueva@example.com",
        },
      },
      error: null,
    });
    const { createClient } = await import("@/lib/supabase/server");

    await expect(getAccountEmails(await createClient())).resolves.toEqual({
      email: "ana@example.com",
      pendingEmail: "ana.nueva@example.com",
    });
  });

  it("has no pending address when there is no change", async () => {
    const { createClient } = await import("@/lib/supabase/server");

    await expect(getAccountEmails(await createClient())).resolves.toEqual({
      email: "ana@example.com",
      pendingEmail: null,
    });
  });
});
