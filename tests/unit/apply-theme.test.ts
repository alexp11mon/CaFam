import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme } from "@/lib/theme/apply-theme";
import { THEME_COLOR, THEME_COOKIE } from "@/lib/theme/theme";

// Spec 011, T7: a theme picked in the browser is applied at once, with a fade
// unless the system asks for reduced motion (RF-3, RF-21, RF-23, RF-24; plan
// theme-apply).
const html = document.documentElement;

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
  }));
}

function stubViewTransition() {
  const start = vi.fn((update: () => void) => {
    update();
    return {};
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: start,
  });
  return start;
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "startViewTransition");
  document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
  html.removeAttribute("data-theme");
  document.head.querySelectorAll("meta").forEach((meta) => meta.remove());
});

describe("applyTheme", () => {
  it("sets the attribute, the theme-color and the cookie", () => {
    stubReducedMotion(false);
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.media = "(prefers-color-scheme: light)";
    document.head.append(meta);

    applyTheme("dark");

    expect(html.dataset.theme).toBe("dark");
    expect(meta.content.toLowerCase()).toBe(THEME_COLOR.dark.toLowerCase());
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it("fades with a view transition when the browser has one (RF-21)", () => {
    stubReducedMotion(false);
    const start = stubViewTransition();

    applyTheme("dark");

    expect(start).toHaveBeenCalledOnce();
    expect(html.dataset.theme).toBe("dark");
  });

  it("changes at once with reduced motion (RF-23)", () => {
    stubReducedMotion(true);
    const start = stubViewTransition();

    applyTheme("light");

    expect(start).not.toHaveBeenCalled();
    expect(html.dataset.theme).toBe("light");
  });

  it("changes at once without view transitions (RF-24)", () => {
    stubReducedMotion(false);

    applyTheme("system");

    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(document.cookie).toContain(`${THEME_COOKIE}=system`);
  });
});
