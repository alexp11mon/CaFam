// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T13: saving the profile and changing the password from Ajustes
// (RF-13 to RF-15, RF-30 to RF-33; plan D7).
const h = vi.hoisted(() => ({
  updateValues: vi.fn(),
  updateRows: [{ id: "u1" }] as { id: string }[] | null,
  updateError: null as unknown,
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  revalidatePath: vi.fn(),
  calls: [] as string[],
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
      signOut: h.signOut,
    },
    from: () => ({
      update: (values: unknown) => {
        h.updateValues(values);
        return {
          eq: () => ({
            select: async () => ({ data: h.updateRows, error: h.updateError }),
          }),
        };
      },
    }),
  }),
}));

const { saveProfile, changePassword } =
  await import("@/app/dashboard/settings/account-actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const PROFILE_STATE = { values: { displayName: "", timeZone: "" } };

beforeEach(() => {
  h.calls.length = 0;
  h.updateValues.mockReset();
  h.updateRows = [{ id: "u1" }];
  h.updateError = null;
  h.revalidatePath.mockReset();
  h.getUser.mockReset().mockResolvedValue({
    data: { user: { id: "u1", email: "ana@example.com" } },
    error: null,
  });
  h.signInWithPassword.mockReset().mockImplementation(async () => {
    h.calls.push("signIn");
    return { error: null };
  });
  h.updateUser.mockReset().mockImplementation(async () => {
    h.calls.push("updateUser");
    return { error: null };
  });
  h.signOut.mockReset().mockImplementation(async () => {
    h.calls.push("signOut");
    return { error: null };
  });
});

describe("saveProfile (RF-13, RF-14, RF-15)", () => {
  it("saves the name and the time zone in the own profile and refreshes the views", async () => {
    const state = await saveProfile(
      PROFILE_STATE,
      form({ displayName: "  Ana María ", timeZone: "America/Bogota" }),
    );

    expect(h.updateValues).toHaveBeenCalledWith({
      display_name: "Ana María",
      time_zone: "America/Bogota",
    });
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(state.saved).toBe(true);
  });

  it("rejects an empty name without touching the profile (RF-15)", async () => {
    const state = await saveProfile(
      PROFILE_STATE,
      form({ displayName: "  ", timeZone: "Europe/Madrid" }),
    );

    expect(h.updateValues).not.toHaveBeenCalled();
    expect(state.fieldErrors?.displayName).toBe("Introduce tu nombre.");
  });

  it("rejects an unknown time zone (RF-15)", async () => {
    const state = await saveProfile(
      PROFILE_STATE,
      form({ displayName: "Ana", timeZone: "Mars/Olympus" }),
    );

    expect(h.updateValues).not.toHaveBeenCalled();
    expect(state.fieldErrors?.timeZone).toBe("Elige una zona horaria válida.");
  });

  it("says so when nothing could be saved", async () => {
    h.updateRows = [];

    const state = await saveProfile(
      PROFILE_STATE,
      form({ displayName: "Ana", timeZone: "Europe/Madrid" }),
    );

    expect(state.saved).toBeUndefined();
    expect(state.formError).toBe(
      "No se ha podido guardar el perfil. Inténtalo de nuevo.",
    );
  });
});

describe("changePassword (RF-30 to RF-33)", () => {
  it("checks the current one, saves the new one and then closes the other sessions", async () => {
    const state = await changePassword(
      {},
      form({ currentPassword: "actual-1234", newPassword: "nueva-12345" }),
    );

    expect(h.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "actual-1234",
    });
    expect(h.updateUser).toHaveBeenCalledWith({ password: "nueva-12345" });
    expect(h.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(h.calls).toEqual(["signIn", "updateUser", "signOut"]);
    expect(state.saved).toBe(true);
  });

  it("does not change anything with a wrong current password (RF-31)", async () => {
    h.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });

    const state = await changePassword(
      {},
      form({ currentPassword: "mala-1234", newPassword: "nueva-12345" }),
    );

    expect(h.updateUser).not.toHaveBeenCalled();
    expect(state.fieldErrors?.currentPassword).toBe(
      "La contraseña actual no es correcta.",
    );
  });

  it("refuses a new password equal to the current one (RF-32)", async () => {
    const state = await changePassword(
      {},
      form({ currentPassword: "misma-12345", newPassword: "misma-12345" }),
    );

    expect(h.signInWithPassword).not.toHaveBeenCalled();
    expect(state.fieldErrors?.newPassword).toBe(
      "La contraseña nueva no puede ser igual a la actual.",
    );
  });

  it("rejects a new password under 8 characters (RF-30)", async () => {
    const state = await changePassword(
      {},
      form({ currentPassword: "actual-1234", newPassword: "corta" }),
    );

    expect(h.signInWithPassword).not.toHaveBeenCalled();
    expect(state.fieldErrors?.newPassword).toBe(
      "La contraseña debe tener al menos 8 caracteres.",
    );
  });

  it("keeps the other sessions when the new password cannot be saved", async () => {
    h.updateUser.mockResolvedValue({ error: { code: "same_password" } });

    const state = await changePassword(
      {},
      form({ currentPassword: "actual-1234", newPassword: "nueva-12345" }),
    );

    expect(h.signOut).not.toHaveBeenCalled();
    expect(state.formError).toBe(
      "La contraseña nueva no puede ser igual a la actual.",
    );
  });
});
