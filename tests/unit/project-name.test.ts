// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The project is called CaFam everywhere (constitution, amendment 3; spec 010,
// RF-10 and RF-14). The old names are built in pieces so this file does not
// match itself.
const OLD_NAMES = new RegExp(
  [
    ["Calendario", "Familia"],
    ["Calender", "Fam"],
  ]
    .map((parts) => parts.join(""))
    .join("|"),
  "i",
);

// Applied migrations are never edited, and spec 010 has to name what it
// renames (plan D2). This list only grows with the user's approval.
const LAST_APPLIED_BEFORE_RENAME = "20261029130000";
function isAllowed(file: string): boolean {
  if (file.startsWith("specs/010-renombrar-cafam/")) return true;
  const migration = file.match(/^supabase\/migrations\/(\d{14})_/);
  return migration !== null && migration[1] < LAST_APPLIED_BEFORE_RENAME;
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

describe("project name (spec 010)", () => {
  it("no tracked file uses an old name of the project", () => {
    const offenders = trackedFiles()
      .filter((file) => !isAllowed(file))
      .flatMap((file) =>
        readFileSync(file, "latin1")
          .split("\n")
          .flatMap((line, index) =>
            OLD_NAMES.test(line) ? [`${file}:${index + 1}`] : [],
          ),
      );
    expect(offenders).toEqual([]);
  });
});
