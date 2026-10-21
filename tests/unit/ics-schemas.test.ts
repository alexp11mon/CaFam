import { describe, expect, it } from "vitest";
import { DEFAULT_CALENDAR_COLOR } from "@/lib/calendar/palette";
import { parseImportForm } from "@/lib/ics/schemas";

const VALID = { url: "", hasFile: true, name: "", color: "" };

describe("parseImportForm name (RF-8)", () => {
  it("is optional: empty means use the one of the .ics", () => {
    const result = parseImportForm({ ...VALID, name: "   " });

    expect(result.ok && result.data.name).toBeNull();
  });

  it("trims a name of 1 to 50 characters", () => {
    expect(parseImportForm({ ...VALID, name: "  Uni  " })).toMatchObject({
      ok: true,
      data: { name: "Uni" },
    });
    expect(parseImportForm({ ...VALID, name: "a".repeat(50) }).ok).toBe(true);
  });

  it("rejects more than 50 characters next to the field", () => {
    expect(parseImportForm({ ...VALID, name: "a".repeat(51) })).toEqual({
      ok: false,
      fieldErrors: { name: "Escribe un nombre de 1 a 50 caracteres." },
    });
  });
});

describe("parseImportForm color (RF-10)", () => {
  it("defaults to the brand blue", () => {
    const result = parseImportForm({ ...VALID, color: "" });

    expect(result.ok && result.data.color).toBe(DEFAULT_CALENDAR_COLOR);
  });

  it("accepts a palette color, uppercased", () => {
    const result = parseImportForm({ ...VALID, color: "#cAFFbf" });

    expect(result.ok && result.data.color).toBe("#CAFFBF");
  });

  it("rejects a color outside the palette", () => {
    expect(parseImportForm({ ...VALID, color: "#123456" })).toEqual({
      ok: false,
      fieldErrors: { color: "Elige uno de los colores de la paleta." },
    });
  });
});

describe("parseImportForm source (RF-1, RF-2)", () => {
  it("accepts a link alone", () => {
    expect(
      parseImportForm({
        ...VALID,
        url: "  https://a.example.com/x.ics ",
        hasFile: false,
      }),
    ).toMatchObject({
      ok: true,
      data: { source: { kind: "url", url: "https://a.example.com/x.ics" } },
    });
  });

  it("accepts a file alone", () => {
    expect(parseImportForm({ ...VALID, url: "", hasFile: true })).toMatchObject(
      {
        ok: true,
        data: { source: { kind: "file" } },
      },
    );
  });

  it.each([
    { url: "", hasFile: false },
    { url: "   ", hasFile: false },
    { url: "https://a.example.com/x.ics", hasFile: true },
  ])("asks for exactly one of link and file: %j", (source) => {
    expect(parseImportForm({ ...VALID, ...source })).toEqual({
      ok: false,
      fieldErrors: { url: "Indica un enlace o sube un archivo, no los dos." },
    });
  });

  it("reports every problem at once", () => {
    const result = parseImportForm({
      url: "",
      hasFile: false,
      name: "a".repeat(51),
      color: "#123456",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual([
      "color",
      "name",
      "url",
    ]);
  });
});
