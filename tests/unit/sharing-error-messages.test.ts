import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import {
  getJoinStatusMessage,
  getSharingErrorMessage,
  SHARING_MESSAGES,
} from "@/lib/sharing/error-messages";

describe("getSharingErrorMessage", () => {
  it("translates an invalid invite (CF404, RF-8)", () => {
    expect(getSharingErrorMessage({ code: "CF404" })).toBe(
      "Esta invitación ya no es válida.",
    );
  });

  it("translates the attempt limit (CF429, RF-21)", () => {
    expect(getSharingErrorMessage({ code: "CF429" })).toBe(
      "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
    );
  });

  it("translates permission errors (42501, RF-29)", () => {
    expect(getSharingErrorMessage({ code: "42501" })).toBe(
      "No tienes permiso para hacer esto.",
    );
  });

  it("translates invalid data (22023)", () => {
    expect(getSharingErrorMessage({ code: "22023" })).toBe(
      "Revisa los datos e inténtalo de nuevo.",
    );
  });

  it("maps unknown codes, network errors and non-objects to the connection message", () => {
    for (const error of [
      { code: "XX000" },
      new Error("fetch failed"),
      null,
      "x",
    ]) {
      expect(getSharingErrorMessage(error)).toBe(AUTH_MESSAGES.connection);
    }
  });
});

describe("getJoinStatusMessage", () => {
  it("says ID or PIN incorrect for invalid (RF-20)", () => {
    expect(getJoinStatusMessage("invalid")).toBe("ID o PIN incorrectos.");
  });

  it("says to wait 15 minutes for limited (RF-21, RF-22)", () => {
    expect(getJoinStatusMessage("limited")).toBe(
      "Demasiados intentos. Espera 15 minutos y vuelve a probar.",
    );
  });
});

describe("SHARING_MESSAGES", () => {
  it("explains that the owner cannot leave or be expelled (RF-28)", () => {
    expect(SHARING_MESSAGES.ownerCannotLeave).toBe(
      "El propietario no puede salir de su calendario ni ser expulsado. Para dejar de serlo, borra el calendario.",
    );
  });
});
