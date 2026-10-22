// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Spec 006, T11: asking for a recovery link answers the same whether or not the
// account exists or the limit applied (RF-1, RF-5; NF-1).
const { rpc, resetPasswordForEmail } = vi.hoisted(() => ({
  rpc: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, auth: { resetPasswordForEmail } }),
}));

const { requestRecovery } =
  await import("@/app/(auth)/forgot-password/actions");

const SENT_STATE = { values: { email: "" } };

function form(email: string) {
  const data = new FormData();
  data.append("email", email);
  return data;
}

beforeEach(() => {
  rpc.mockReset();
  resetPasswordForEmail.mockReset();
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

describe("requestRecovery (RF-1, RF-5)", () => {
  it("sends the link when the limit allows it", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    const state = await requestRecovery(SENT_STATE, form("ana@example.com"));

    expect(rpc).toHaveBeenCalledWith("request_recovery", {
      p_email: "ana@example.com",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("ana@example.com");
    expect(state).toEqual({ sent: true, values: { email: "" } });
  });

  it("gives the same answer when the limit refuses, without sending mail", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    const state = await requestRecovery(SENT_STATE, form("ana@example.com"));

    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(state).toEqual({ sent: true, values: { email: "" } });
  });

  it("rejects a malformed address before asking anything", async () => {
    const state = await requestRecovery(SENT_STATE, form("no-es-email"));

    expect(rpc).not.toHaveBeenCalled();
    expect(state.fieldErrors?.email).toBe("Introduce un email válido.");
  });

  it("shows the connection message when the request fails", async () => {
    rpc.mockResolvedValue({ data: null, error: new TypeError("fetch failed") });

    const state = await requestRecovery(SENT_STATE, form("ana@example.com"));

    expect(state.sent).toBeUndefined();
    expect(state.formError).toBe(
      "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  });
});
