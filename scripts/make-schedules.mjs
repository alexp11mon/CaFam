// Spec 022, T11: renders tests/fixtures/schedules/cases.ts to JPEG fixtures.
// Uses the global playwright-cli with the system Edge (AGENTS.md trap), so
// it adds no dependency. Run: node --experimental-strip-types scripts/make-schedules.mjs
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = join(process.cwd(), "tests/fixtures/schedules");
const { CASES } = await import(pathToFileURL(join(dir, "cases.ts")).href);
const root = execSync("npm root -g").toString().trim();
const require = createRequire(import.meta.url);
const { chromium } = require(
  join(root, "@playwright/cli/node_modules/playwright-core"),
);

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1100, height: 400 } });
const seen = new Set();
for (const { id, html } of CASES) {
  if (seen.has(html)) continue; // cases sharing an image reuse its file
  seen.add(html);
  await page.setContent(html);
  const shot = await page.screenshot({
    type: "jpeg",
    quality: 85,
    fullPage: true,
  });
  writeFileSync(join(dir, `${id}.jpg`), shot);
  console.log(`${id}.jpg`);
}
await browser.close();
