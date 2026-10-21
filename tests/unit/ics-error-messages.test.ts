import { describe, expect, it } from "vitest";
import { getImportErrorMessage } from "@/lib/ics/error-messages";

describe("getImportErrorMessage", () => {
  it("explains an invalid link (RF-4)", () => {
    expect(getImportErrorMessage({ kind: "invalid-url" })).toBe(
      "El enlace no es válido. Debe empezar por https:// o webcal://.",
    );
  });

  it("explains an unreachable link (RF-5)", () => {
    expect(getImportErrorMessage({ kind: "unreachable" })).toBe(
      "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo.",
    );
  });

  it("states the size limit (RF-26)", () => {
    expect(getImportErrorMessage({ kind: "too-large" })).toBe(
      "El archivo supera el límite de 2 MB.",
    );
  });

  it("states how many events there would be and the limit (RF-27)", () => {
    expect(
      getImportErrorMessage({ kind: "too-many", count: 2500, capped: false }),
    ).toBe("El calendario tendría 2.500 eventos y el límite es de 2.000.");
    expect(
      getImportErrorMessage({ kind: "too-many", count: 2001, capped: false }),
    ).toBe("El calendario tendría 2.001 eventos y el límite es de 2.000.");
  });

  it("says more than 20,000 past the counting cap (plan D8)", () => {
    expect(
      getImportErrorMessage({ kind: "too-many", count: 20_001, capped: true }),
    ).toBe(
      "El calendario tendría más de 20.000 eventos y el límite es de 2.000.",
    );
  });

  it("explains content that is not an .ics (RF-28)", () => {
    expect(getImportErrorMessage({ kind: "not-ics" })).toBe(
      "El contenido no es un calendario .ics válido.",
    );
  });

  it("explains a calendar with nothing importable (RF-28)", () => {
    expect(getImportErrorMessage({ kind: "no-events" })).toBe(
      "El calendario no tiene eventos que se puedan importar.",
    );
  });

  it("says nothing was saved when creating fails (RF-30)", () => {
    expect(getImportErrorMessage({ kind: "create-failed" })).toBe(
      "No se ha podido crear el calendario. No se ha guardado nada.",
    );
  });

  it("never carries a link (RF-6)", () => {
    const kinds = [
      "invalid-url",
      "unreachable",
      "too-large",
      "not-ics",
      "no-events",
      "create-failed",
    ] as const;

    for (const kind of kinds) {
      expect(getImportErrorMessage({ kind })).not.toMatch(/https?:\/\/[a-z]/i);
    }
  });
});
