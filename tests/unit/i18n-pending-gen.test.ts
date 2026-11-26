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

// MISSING_OUT=<file> npm test -- i18n-pending-gen lists the texts with no English yet.
it.runIf(process.env.MISSING_OUT)("writes the missing texts", async () => {
  const { EN } = await import("@/i18n/en");
  const { translatedTexts } = await import("./i18n-scan");
  const missing: Record<string, string[]> = {};
  for (const [text, file] of translatedTexts()) {
    if (text in EN) continue;
    (missing[file] ??= []).push(text);
  }
  writeFileSync(process.env.MISSING_OUT!, JSON.stringify(missing, null, 1));
});

// LEFT_OUT=<file> npm test -- i18n-pending-gen lists what is left, by file.
it.runIf(process.env.LEFT_OUT)("writes what is left", async () => {
  const { EN } = await import("@/i18n/en");
  const { NOT_SHOWN } = await import("./i18n-pending");
  const left: Record<string, string[]> = {};
  for (const { file, line, text } of strayTexts())
    (left[file] ??= []).push(`${line}: ${text}`);
  for (const { file, text } of spanishLiterals()) {
    if (NOT_SHOWN.some((p) => file.startsWith(p)) || text in EN) continue;
    (left[file] ??= []).push(`lit: ${text}`);
  }
  writeFileSync(process.env.LEFT_OUT!, JSON.stringify(left, null, 1));
});
