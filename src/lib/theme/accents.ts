// The interface accents a user can pick and the neutral colors around them:
// the "Nexo" identity (constitution, amendment 11; spec 030 RF-2). globals.css
// repeats these values as CSS variables and theme-css.test.ts keeps both equal.

export const ACCENT_IDS = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "gray",
] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export interface Accent {
  id: AccentId;
  label: string;
  /** Solid fill: today, the selection and the main action of a screen. */
  fill: string;
  /** Where the gradient of the main action ends (spec 030 RF-2). */
  to: string;
  /** Text drawn on top of `fill` and of `to`. */
  onFill: string;
  /** Text and thin lines on stone or paper (weekdays, the now line). */
  ink: string;
  /** Outline of a filled shape: `ink` when `fill` alone fades into the surface (plan R6). */
  edge: string;
  /** `ink` and `edge` on the dark surfaces (spec 011 RF-9); fill and onFill stay. */
  dark: { ink: string; edge: string };
}

export const DEFAULT_ACCENT: AccentId = "red";

const WHITE = "#FFFFFF";

export const NEUTRALS = {
  // Lavender behind every screen (constitution, amendment 11).
  stone: "#F3F2FA",
  // Surfaces are plain white on it.
  paper: "#FFFFFF",
  // Text and icons: a violet-tinted near black.
  ink: "#1D1B2E",
  muted: "#6F6C86",
  line: "#E9E7F5",
  // Input and select borders need 3:1 against their surface (WCAG 1.4.11).
  control: "#8B88A6",
  danger: "#C8233F",
} as const;

/** The same tokens in the dark theme. */
export const DARK_NEUTRALS: Record<keyof typeof NEUTRALS, string> = {
  stone: "#0F0E1A",
  paper: "#18172A",
  ink: "#EFEEFA",
  muted: "#A09DB8",
  line: "#2a2842",
  control: "#6A6786",
  danger: "#FF8FA3",
};

/**
 * Text on the ink button, text on the pastel calendar colors and the brand
 * mark (spec 011 RF-10, plan D5): pastel text never flips. The mark is the
 * violet tile in both themes (spec 030): it does not follow the accent.
 */
export const BRAND = { tile: "#6D5BF0", onTile: "#FFFFFF" } as const;

/** Venito, the mascot (spec 027 RF-1, plan D5): its own colors in each theme. */
export const VENITO = {
  light: {
    seal: "#8DA3B0",
    light: "#E9EFF2",
    dark: "#22323F",
    blush: "#F2A99B",
  },
  dark: {
    seal: "#9FB4C0",
    light: "#EEF3F5",
    dark: "#0F0E1A",
    blush: "#F2A99B",
  },
} as const;

export const THEME_INKS = {
  light: {
    onInk: WHITE,
    pastelInk: NEUTRALS.ink,
    mark: BRAND.tile,
    onMark: BRAND.onTile,
  },
  dark: {
    onInk: DARK_NEUTRALS.stone,
    pastelInk: NEUTRALS.ink,
    mark: BRAND.tile,
    onMark: BRAND.onTile,
  },
} as const;

/** The two elevations (constitution, amendment 10): at rest and floating. */
export const ELEVATION = {
  light: {
    soft: "0 1px 2px rgb(60 40 140 / 0.05), 0 1px 1px rgb(60 40 140 / 0.03)",
    float:
      "0 16px 36px -10px rgb(60 40 140 / 0.28), 0 4px 12px rgb(60 40 140 / 0.08)",
  },
  dark: {
    soft: "0 1px 2px rgb(0 0 0 / 0.4)",
    float: "0 18px 40px -8px rgb(0 0 0 / 0.6), 0 4px 12px rgb(0 0 0 / 0.35)",
  },
} as const;

export const ACCENTS: readonly Accent[] = [
  {
    id: "red",
    label: "Violeta",
    fill: "#6D5BF0",
    to: "#4371D0",
    onFill: WHITE,
    ink: "#5442D6",
    edge: "#6D5BF0",
    dark: { ink: "#C2BAFF", edge: "#6D5BF0" },
  },
  {
    id: "blue",
    label: "Azul",
    fill: "#2F6FE0",
    to: "#217CAD",
    onFill: WHITE,
    ink: "#2459BE",
    edge: "#2F6FE0",
    dark: { ink: "#9CC2FF", edge: "#2F6FE0" },
  },
  {
    id: "green",
    label: "Verde",
    fill: "#1A8458",
    to: "#2B827E",
    onFill: WHITE,
    ink: "#167049",
    edge: "#1A8458",
    dark: { ink: "#6FE0AE", edge: "#1A8458" },
  },
  {
    id: "yellow",
    label: "Ámbar",
    fill: "#F4A62A",
    to: "#F47F3C",
    onFill: NEUTRALS.ink,
    ink: "#8A5300",
    edge: "#8A5300",
    dark: { ink: "#F7B84A", edge: "#F4A62A" },
  },
  {
    id: "purple",
    label: "Rosa",
    fill: "#D6336C",
    to: "#C84A2A",
    onFill: WHITE,
    ink: "#B8255A",
    edge: "#D6336C",
    dark: { ink: "#FFA6C8", edge: "#D6336C" },
  },
  {
    id: "gray",
    label: "Grafito",
    fill: "#4B4963",
    to: "#5E6B85",
    onFill: WHITE,
    ink: "#4B4963",
    edge: "#4B4963",
    dark: { ink: "#C3C1D6", edge: "#C3C1D6" },
  },
];

export function isAccent(value: unknown): value is AccentId {
  return ACCENT_IDS.some((id) => id === value);
}
