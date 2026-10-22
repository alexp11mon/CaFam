import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web app manifest (RF-21, RNF-9)", () => {
  const result = manifest();

  it("has the app identity and display settings", () => {
    expect(result).toMatchObject({
      name: "CalenderFam",
      short_name: "CaFam",
      // Stone, the ground of the new identity (spec 005 RF-53).
      theme_color: "#E8E5DD",
      background_color: "#E8E5DD",
      display: "standalone",
      // Straight to the calendar, the home screen (spec 005 RF-15).
      start_url: "/dashboard/calendar",
      lang: "es",
    });
  });

  it("declares the 192, 512 and 512 maskable icons", () => {
    expect(result.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        }),
        expect.objectContaining({
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        }),
      ]),
    );
  });

  it("points every icon to an existing file in public/", () => {
    for (const icon of result.icons ?? []) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
  });
});
