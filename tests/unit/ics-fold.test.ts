import { describe, expect, it } from "vitest";
import { escapeText, foldLine } from "@/lib/ics/fold";

// Spec 043, T1: RFC 5545 escapes and line folding at 75 octets (RF-3, RNF-1).
const bytes = (text: string) => new TextEncoder().encode(text).length;

describe("escapeText", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:Hola")).toBe("SUMMARY:Hola");
  });

  it("folds at 75 octets with a leading space", () => {
    const folded = foldLine(`DESCRIPTION:${"x".repeat(200)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBe(3);
    for (const line of lines) expect(bytes(line)).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(lines.map((line, i) => (i ? line.slice(1) : line)).join("")).toBe(
      `DESCRIPTION:${"x".repeat(200)}`,
    );
  });

  it("never splits a multibyte character", () => {
    const text = `SUMMARY:${"ñ€😀".repeat(40)}`;
    const lines = foldLine(text).split("\r\n");
    for (const line of lines) {
      expect(bytes(line)).toBeLessThanOrEqual(75);
      expect(line).not.toMatch(/�/);
    }
    expect(lines.map((line, i) => (i ? line.slice(1) : line)).join("")).toBe(
      text,
    );
  });
});
