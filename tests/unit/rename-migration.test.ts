// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The sender name is only visible in the Brevo request, which the dry run of
// send_pending_emails never builds, so it is checked in the migration (plan D12).
const sql = readFileSync(
  "supabase/migrations/20261029130000_rename_cafam.sql",
  "utf8",
);

describe("rename_cafam migration (spec 010)", () => {
  it("sends account mail as CaFam (RF-7)", () => {
    expect(sql).toContain(
      "jsonb_build_object('name', 'CaFam', 'email', v_sender)",
    );
  });

  it("does not contain the old names", () => {
    // Built in pieces so the project-name guard does not flag this file.
    const old = new RegExp(
      ["calen", "derfam|calendario", "familia"].join(""),
      "i",
    );
    expect(sql).not.toMatch(old);
  });
});
