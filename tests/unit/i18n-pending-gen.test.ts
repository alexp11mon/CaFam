import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { spanishLiterals, strayTexts } from "./i18n-scan";
import { NOT_SHOWN } from "./i18n-pending";

// PENDING_OUT=<file> npm test -- i18n-pending-gen rewrites the starting list.
it.runIf(process.env.PENDING_OUT)("writes the pending list", () => {
  const files = new Set([
    ...strayTexts().map(({ file }) => file),
    ...spanishLiterals()
      .filter(({ file }) => !NOT_SHOWN.some((p) => file.startsWith(p)))
      .map(({ file }) => file),
  ]);
  writeFileSync(
    process.env.PENDING_OUT!,
    JSON.stringify([...files].sort(), null, 1),
  );
});
