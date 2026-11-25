import { describe, expect, it } from "vitest";
import {
  exportFileName,
  readme,
  safeName,
  uniqueNames,
} from "@/lib/export/account-files";

// Spec 049, T4: file names inside the export (RF-13).
describe("safeName", () => {
  it("keeps accents and drops what Windows refuses", () => {
    expect(safeName("Cumpleaños: 2026/27?")).toBe("Cumpleaños_ 2026_27_");
    expect(safeName("  ..oculto.  ")).toBe("oculto");
    expect(safeName("CON")).toBe("sin nombre");
    expect(safeName("")).toBe("sin nombre");
    expect(safeName("x".repeat(200))).toHaveLength(80);
  });
});

describe("uniqueNames", () => {
  it("numbers repeated names, without minding case", () => {
    const name = uniqueNames();
    expect(name("Familia", ".ics")).toBe("Familia.ics");
    expect(name("familia", ".ics")).toBe("familia (2).ics");
    expect(name("Familia", ".ics")).toBe("Familia (3).ics");
  });
});

describe("export files", () => {
  it("names the archive by date and explains each file", () => {
    const date = new Date(2026, 10, 5);
    expect(exportFileName(date)).toBe("cafam-2026-11-05.zip");
    const text = readme(date, false);
    for (const file of [
      "perfil.json",
      "calendarios.json",
      "comentarios.json",
      "notas.json",
    ]) {
      expect(text).toContain(file);
    }
    expect(text).toContain("No incluidas");
  });
});
