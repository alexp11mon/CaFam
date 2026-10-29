import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeSync } from "@/components/shell/theme-sync";
import { THEME_COLOR, THEME_COOKIE } from "@/lib/theme/theme";

// Spec 011, T6: a device with an old cookie takes the theme of the profile
// without animation (RF-4; plan flow step 6).
const html = document.documentElement;

function meta(media: string) {
  const element = document.createElement("meta");
  element.name = "theme-color";
  element.media = media;
  element.content = "#000000";
  document.head.append(element);
  return element;
}

function cookie() {
  return document.cookie.match(new RegExp(`${THEME_COOKIE}=([^;]*)`))?.[1];
}

afterEach(() => {
  document.cookie = `${THEME_COOKIE}=; max-age=0; path=/`;
  html.removeAttribute("data-theme");
  document.head.querySelectorAll("meta").forEach((element) => element.remove());
});

describe("ThemeSync (RF-4)", () => {
  it("applies the profile theme over an old cookie", () => {
    document.cookie = `${THEME_COOKIE}=light; path=/`;
    html.dataset.theme = "light";
    const light = meta("(prefers-color-scheme: light)");

    render(<ThemeSync theme="dark" />);

    expect(html.dataset.theme).toBe("dark");
    expect(cookie()).toBe("dark");
    expect(light.content.toLowerCase()).toBe(THEME_COLOR.dark.toLowerCase());
  });

  it("goes back to the system theme: no attribute, each meta its own color", () => {
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    html.dataset.theme = "dark";
    const light = meta("(prefers-color-scheme: light)");
    const dark = meta("(prefers-color-scheme: dark)");

    render(<ThemeSync theme="system" />);

    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(cookie()).toBe("system");
    expect(light.content.toLowerCase()).toBe(THEME_COLOR.light.toLowerCase());
    expect(dark.content.toLowerCase()).toBe(THEME_COLOR.dark.toLowerCase());
  });

  it("does nothing when the cookie already matches", () => {
    document.cookie = `${THEME_COOKIE}=dark; path=/`;
    const light = meta("(prefers-color-scheme: light)");

    render(<ThemeSync theme="dark" />);

    // The boot script already painted; ThemeSync leaves the page as it is.
    expect(html.hasAttribute("data-theme")).toBe(false);
    expect(light.content).toBe("#000000");
  });

  it("renders nothing", () => {
    const { container } = render(<ThemeSync theme="light" />);
    expect(container).toBeEmptyDOMElement();
  });
});
