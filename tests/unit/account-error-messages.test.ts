import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import { getAccountErrorMessage } from "@/lib/account/error-messages";

// Spec 006, T12: account errors in Spanish, without revealing whether an
// account exists (RF-7, RF-8, RF-12, RF-31, RF-32; NF-1).

describe("getAccountErrorMessage", () => {
  it("a wrong current password says so (RF-7, RF-31)", () => {
    expect(getAccountErrorMessage({ code: "invalid_credentials" })).toBe(
      "La contraseña actual no es correcta.",
    );
  });

  it("a new password equal to the current one is refused (RF-32)", () => {
    expect(getAccountErrorMessage({ code: "same_password" })).toBe(
      "La contraseña nueva no puede ser igual a la actual.",
    );
  });

  it("an address already used by another account is refused (RF-8)", () => {
    expect(getAccountErrorMessage({ code: "email_exists" })).toBe(
      "Esa dirección ya la usa otra cuenta.",
    );
    expect(getAccountErrorMessage({ code: "user_already_exists" })).toBe(
      "Esa dirección ya la usa otra cuenta.",
    );
  });

  it("an expired or used link asks for a new one (RF-3, RF-12)", () => {
    expect(getAccountErrorMessage({ code: "otp_expired" })).toBe(
      "El enlace no es válido o ha caducado. Pide uno nuevo.",
    );
  });

  it("a network failure or an unknown code shows the connection message", () => {
    expect(getAccountErrorMessage(new TypeError("fetch failed"))).toBe(
      AUTH_MESSAGES.connection,
    );
    expect(getAccountErrorMessage({ code: "something_new" })).toBe(
      AUTH_MESSAGES.connection,
    );
  });

  it("never says whether an account exists", () => {
    const messages = [
      getAccountErrorMessage({ code: "invalid_credentials" }),
      getAccountErrorMessage({ code: "otp_expired" }),
      getAccountErrorMessage(new TypeError("fetch failed")),
    ];
    for (const message of messages) {
      expect(message).not.toMatch(/no existe|sin cuenta/i);
    }
  });
});
