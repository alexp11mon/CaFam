import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Constitution P4: server-only secrets must never appear in app code.
const FORBIDDEN_PATTERNS = ["SUPABASE_SECRET_KEY", "service_role"];
const SRC_DIR = join(process.cwd(), "src");

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe("no secrets in src/", () => {
  it("contains no reference to server-only secrets", () => {
    const offenders = listFiles(SRC_DIR).flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return FORBIDDEN_PATTERNS.filter((pattern) =>
        content.includes(pattern),
      ).map((pattern) => `${file}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });
});
