import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  effectiveTheme,
  nextToggleTheme,
  parseTheme,
  THEME_COLOR,
  THEME_COOKIE,
  THEME_SCRIPT,
  themeSchema,
} from "@/lib/theme/theme";

// Spec 011, T2: the theme ids, the toggle and the boot script (RF-2, RF-6,
// RF-7, RF-8; plan theme-core, D3).
describe("parseTheme", () => {
  it("accepts the three themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to the system theme (RF-2)", () => {
    expect(DEFAULT_THEME).toBe("system");
    for (const value of [undefined, null, "", "sepia", 3]) {
      expect(parseTheme(value)).toBe("system");
    }
  });
});

describe("themeSchema", () => {
  it("explains a wrong value in Spanish", () => {
    const result = themeSchema.safeParse("sepia");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Elige uno de los temas disponibles.",
    );
  });
});

describe("effectiveTheme and nextToggleTheme (RF-6)", () => {
  it("resolves the system theme with the OS preference", () => {
    expect(effectiveTheme("system", true)).toBe("dark");
    expect(effectiveTheme("system", false)).toBe("light");
    expect(effectiveTheme("light", true)).toBe("light");
    expect(effectiveTheme("dark", false)).toBe("dark");
  });

  it("toggles to the opposite of what is on screen", () => {
    expect(nextToggleTheme("light")).toBe("dark");
    expect(nextToggleTheme("dark")).toBe("light");
  });
});

describe("THEME_SCRIPT (RF-7, RF-8)", () => {
  const html = document.documentElement;

  function run(cookie?: string) {
    if (cookie) document.cookie = `${THEME_COOKIE}=${cookie}; path=/`;
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#000000";
    document.head.append(meta);
    new Function(THEME_SCRIPT)();
    return meta;
  }

  afterEach(() => {
    document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
    html.removeAttribute("data-theme");
    document.head.querySelectorAll("meta").forEach((meta) => meta.remove());
  });

  it("paints the dark theme before the first frame", () => {
    const meta = run("dark");
    expect(html.dataset.theme).toBe("dark");
    expect(meta.content.toLowerCase()).toBe(THEME_COLOR.dark.toLowerCase());
  });

  it("paints the light theme", () => {
    const meta = run("light");
    expect(html.dataset.theme).toBe("light");
    expect(meta.content.toLowerCase()).toBe(THEME_COLOR.light.toLowerCase());
  });

  it("leaves the system theme to CSS without the cookie or with system", () => {
    run();
    expect(html.hasAttribute("data-theme")).toBe(false);
    run("system");
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("ignores a junk cookie without throwing", () => {
    expect(() => run("<script>")).not.toThrow();
    expect(html.hasAttribute("data-theme")).toBe(false);
  });

  it("is small enough to inline in every page", () => {
    expect(new TextEncoder().encode(THEME_SCRIPT).length).toBeLessThan(600);
  });
});
