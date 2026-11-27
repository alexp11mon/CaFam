import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("web app manifest (RF-21, RNF-9)", () => {
  const result = manifest();

  it("has the app identity and display settings", () => {
    expect(result).toMatchObject({
      name: "CaFam",
      short_name: "CaFam",
      // Stone, the ground of the new identity (spec 005 RF-53).
      theme_color: "#F3F2FA",
      background_color: "#F3F2FA",
      display: "standalone",
      // Straight to the calendar, the home screen (spec 005 RF-15).
      start_url: "/dashboard",
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

  it("receives .ics, images, text and links from other apps (spec 047 RF-5)", () => {
    expect(result.share_target).toEqual({
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          { name: "files", accept: ["text/calendar", ".ics", "image/*"] },
        ],
      },
    });
  });

  it("offers four shortcuts with their own 96 px icons (spec 047 RF-11)", () => {
    expect(result.shortcuts?.map(({ name, url }) => ({ name, url }))).toEqual([
      { name: "Nuevo evento", url: "/dashboard/events/new" },
      { name: "Hoy", url: "/dashboard/calendar?view=day" },
      { name: "Notas", url: "/dashboard/notes" },
      { name: "Preguntar a Venito", url: "/dashboard/assistant" },
    ]);
    for (const shortcut of result.shortcuts ?? []) {
      expect(shortcut.icons).toHaveLength(1);
      expect(shortcut.icons?.[0]).toMatchObject({
        sizes: "96x96",
        type: "image/png",
      });
      expect(
        existsSync(join(process.cwd(), "public", shortcut.icons![0].src)),
      ).toBe(true);
    }
  });
});
