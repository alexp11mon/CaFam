// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 005, T10: the new icons, drawn once from public/icons/icon.svg
// (RF-51, RF-52, RF-54; plan D14, D18).
function pngSize(file: string): [number, number] {
  const data = readFileSync(join(process.cwd(), file));
  // PNG signature, then the IHDR chunk with width and height (big endian).
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

describe("app icons (RF-52)", () => {
  it.each([
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/icon-512-maskable.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
  ])("%s is %i px square", (file, size) => {
    expect(pngSize(file)).toEqual([size, size]);
  });

  it("comes from one SVG in ink and stone, also used as favicon", () => {
    const master = readFileSync("public/icons/icon.svg", "utf8");
    const favicon = readFileSync("src/app/icon.svg", "utf8");

    expect(master).toMatch(/#141414/i);
    expect(master).toMatch(/#E8E5DD/i);
    expect(favicon).toBe(master);
  });
});

describe("service worker version (RF-54, plan D18)", () => {
  const code = readFileSync("public/sw.js", "utf8");

  it("uses a new cache name so installed apps drop the old icons", () => {
    expect(code).toMatch(/const CACHE_NAME = "calenderfam-v2";/);
  });

  it("deletes every cache with another name when it activates", () => {
    expect(code).toMatch(/key !== CACHE_NAME/);
    expect(code).toMatch(/caches\.delete\(key\)/);
  });
});
