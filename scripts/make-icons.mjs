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

// Shortcut icons of 96 px (spec 047 RF-11): the glyphs of
// components/shell/icons.tsx, white on the Violeta of the app icon.
const GLYPHS = {
  new: '<path d="M12 5v14M5 12h14"/>',
  today:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="12" cy="15.5" r="1.5" fill="#FFFFFF"/>',
  notes:
    '<path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M8.5 12.5l1.5 1.5 3-3M8.5 17.5h7"/>',
  venito: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8.5 10.5h7"/>',
};
for (const [name, glyph] of Object.entries(GLYPHS))
  TARGETS.push([
    `public/icons/shortcut-${name}.png`,
    96,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#6D5BF0"/><g transform="translate(24 24) scale(2)" fill="none" stroke="#FFFFFF" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`,
  ]);

// Edge, the browser this environment has (AGENTS.md).
const browser = await chromium.launch({ channel: "msedge" });
try {
  for (const [file, size, drawing = svg] of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${drawing}`,
    );
    writeFileSync(file, await page.screenshot({ omitBackground: false }));
    await page.close();
    console.log(file);
  }
} finally {
  await browser.close();
}
