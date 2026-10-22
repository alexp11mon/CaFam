// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T11: a recovery session sets a new password and closes the other
// sessions of the account (RF-2, RF-4).
const { getUser, updateUser, signOut, calls } = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  calls: [] as string[],
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser, signOut },
  }),
}));

const { resetPassword } = await import("@/app/(auth)/reset-password/actions");

const STATE = {};

function form(password: string) {
  const data = new FormData();
  data.append("password", password);
  return data;
}

beforeEach(() => {
  calls.length = 0;
  getUser.mockReset().mockResolvedValue({
    data: { user: { id: "u1" } },
    error: null,
  });
  updateUser.mockReset().mockImplementation(async () => {
    calls.push("updateUser");
    return { error: null };
  });
  signOut.mockReset().mockImplementation(async () => {
    calls.push("signOut");
    return { error: null };
  });
});

describe("resetPassword (RF-2, RF-4)", () => {
  it("saves the new password, then closes the other sessions, then enters the app", async () => {
    await expect(resetPassword(STATE, form("nueva-12345"))).rejects.toThrow(
      "REDIRECT:/dashboard/calendar",
    );

    expect(updateUser).toHaveBeenCalledWith({ password: "nueva-12345" });
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(calls).toEqual(["updateUser", "signOut"]);
  });

  it("rejects a password under 8 characters without touching the account", async () => {
    const state = await resetPassword(STATE, form("corta"));

    expect(updateUser).not.toHaveBeenCalled();
    expect(state.fieldErrors?.password).toBe(
      "La contraseña debe tener al menos 8 caracteres.",
    );
  });

  it("refuses the same password as the current one and keeps the other sessions (RF-32)", async () => {
    updateUser.mockImplementation(async () => ({
      error: { code: "same_password" },
    }));

    const state = await resetPassword(STATE, form("nueva-12345"));

    expect(state.formError).toBe(
      "La contraseña nueva no puede ser igual a la actual.",
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it("asks for a new link when there is no recovery session (RF-3)", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { code: "x" } });

    const state = await resetPassword(STATE, form("nueva-12345"));

    expect(updateUser).not.toHaveBeenCalled();
    expect(state.formError).toBe(
      "El enlace no es válido o ha caducado. Pide uno nuevo.",
    );
  });
});
