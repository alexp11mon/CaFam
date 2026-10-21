import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "@/lib/auth/error-messages";
import {
  CALENDAR_MESSAGES,
  getCalendarErrorMessage,
} from "@/lib/calendar/error-messages";

describe("getCalendarErrorMessage", () => {
  it("translates a duplicate category (23505, RF-10)", () => {
    expect(getCalendarErrorMessage({ code: "23505" })).toBe(
      "Ya existe una categoría con ese nombre.",
    );
  });

  it("translates permission errors (42501, RF-8, RF-14, RF-25)", () => {
    expect(getCalendarErrorMessage({ code: "42501" })).toBe(
      "No tienes permiso para hacer esto.",
    );
  });

  it("explains that only owners can merge (RF-53)", () => {
    expect(getCalendarErrorMessage({ code: "42501" }, "merge")).toBe(
      "Solo puedes juntar calendarios de los que eres propietario.",
    );
  });

  it("translates a category from another calendar (23503, RF-28)", () => {
    expect(getCalendarErrorMessage({ code: "23503" })).toBe(
      "Esa categoría no existe en el calendario elegido.",
    );
  });

  it("translates missing rows (PGRST116)", () => {
    expect(getCalendarErrorMessage({ code: "PGRST116" })).toBe(
      "Este elemento ya no existe.",
    );
  });

  it("translates invalid data rejected by the database (22023, 23514)", () => {
    for (const code of ["22023", "23514"]) {
      expect(getCalendarErrorMessage({ code })).toBe(
        CALENDAR_MESSAGES.invalidData,
      );
    }
  });

  it("falls back to the connection message for unknown codes, network errors and non-objects", () => {
    expect(getCalendarErrorMessage({ code: "XX000" })).toBe(
      AUTH_MESSAGES.connection,
    );
    expect(getCalendarErrorMessage(new TypeError("fetch failed"))).toBe(
      AUTH_MESSAGES.connection,
    );
    expect(getCalendarErrorMessage(null)).toBe(AUTH_MESSAGES.connection);
    expect(getCalendarErrorMessage("boom")).toBe(AUTH_MESSAGES.connection);
  });
});
