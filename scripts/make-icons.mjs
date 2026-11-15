// Draws the PWA icons from the master SVG (spec 025 RF-7, plan D9):
//   node scripts/make-icons.mjs
// Chromium paints public/icons/icon.svg at each size. Playwright is a
// development tool of this repository's environment, never part of the app.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const svg = readFileSync("public/icons/icon.svg", "utf8");
const TARGETS = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  // The drawing already keeps inside the safe zone of a maskable icon.
  ["public/icons/icon-512-maskable.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

const browser = await chromium.launch();
try {
  for (const [file, size] of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    writeFileSync(file, await page.screenshot({ omitBackground: false }));
    await page.close();
    console.log(file);
  }
} finally {
  await browser.close();
}
