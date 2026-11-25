// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, zipStore } from "@/lib/export/zip-store";

// Spec 049, T4: a .zip without dependencies (RNF-1).
// bsdtar reads .zip; the GNU tar of Git Bash, first in PATH on Windows, does not.
const TAR =
  process.platform === "win32"
    ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
    : "tar";
const text = (value: string) => new TextEncoder().encode(value);

describe("crc32", () => {
  it("matches known vectors", () => {
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
    expect(crc32(text("The quick brown fox jumps over the lazy dog"))).toBe(
      0x414fa339,
    );
  });
});

describe("zipStore", () => {
  it("writes the headers and the UTF-8 names", async () => {
    const bytes = new Uint8Array(
      await zipStore(
        [{ name: "año/ñ.txt", data: text("hola") }],
        new Date(2026, 10, 25, 10, 30, 0),
      ).arrayBuffer(),
    );
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint16(6, true)).toBe(0x0800);
    expect(view.getUint32(14, true)).toBe(crc32(text("hola")));
    // End of central directory: one entry.
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(1);
  });

  it("is a .zip that tar lists, empty files included", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cafam-zip-"));
    try {
      const file = join(dir, "datos.zip");
      const blob = zipStore([
        { name: "LEEME.txt", data: text("hola") },
        { name: "vacío.json", data: new Uint8Array() },
        { name: "calendarios/Familia.ics", data: text("BEGIN:VCALENDAR") },
      ]);
      writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));
      const listed = execFileSync(TAR, ["-tf", file], { encoding: "utf8" })
        .split(/\r?\n/)
        .filter(Boolean);
      // The console code page of Windows may mangle "í": the UTF-8 flag is
      // checked on the bytes above.
      expect(listed).toHaveLength(3);
      expect(listed).toContain("LEEME.txt");
      expect(listed).toContain("calendarios/Familia.ics");
      const content = execFileSync(TAR, ["-xOf", file, "LEEME.txt"], {
        encoding: "utf8",
      });
      expect(content).toBe("hola");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
