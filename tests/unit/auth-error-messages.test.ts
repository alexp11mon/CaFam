import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, getAuthErrorMessage } from "@/lib/auth/error-messages";

describe("getAuthErrorMessage", () => {
  it.each([
    ["user_already_exists", "Ya existe una cuenta con este email."],
    ["email_exists", "Ya existe una cuenta con este email."],
    ["invalid_credentials", "Email o contraseña incorrectos."],
    ["weak_password", "La contraseña debe tener al menos 8 caracteres."],
    [
      "over_request_rate_limit",
      "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    ],
    [
      "over_email_send_rate_limit",
      "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    ],
  ])("translates %s", (code, message) => {
    expect(getAuthErrorMessage({ code, status: 400 })).toBe(message);
  });

  it.each([
    ["an unknown code", { code: "something_new", status: 400 }],
    ["a 5xx error", { status: 503 }],
    ["a network error", new TypeError("fetch failed")],
    ["nothing", undefined],
  ])("falls back to the connection message for %s (RF-12)", (_label, error) => {
    expect(getAuthErrorMessage(error)).toBe(
      "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
    );
  });

  it("exposes the messages used by the forms", () => {
    expect(AUTH_MESSAGES.invalidCredentials).toBe(
      "Email o contraseña incorrectos.",
    );
  });
});
