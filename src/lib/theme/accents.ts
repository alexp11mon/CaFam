// The interface accents a user can pick and the neutral colors around them:
// the "Orilla" identity (constitution, amendment 10; spec 025 RF-2). globals.css
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
  /** Text drawn on top of `fill`. */
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
  // "Bruma": the pale sea mist behind every screen (constitution, amendment 10).
  stone: "#EEF3F4",
  // Surfaces are plain white on it.
  paper: "#FFFFFF",
  // "Mar profundo": text, icons and secondary buttons. Never pure black.
  ink: "#0E2233",
  muted: "#4E6172",
  line: "#D5DEE2",
  // Input and select borders need 3:1 against their surface (WCAG 1.4.11).
  control: "#74858F",
  danger: "#C4372B",
} as const;

/** The same tokens in the dark theme: night sea and slate surfaces. */
export const DARK_NEUTRALS: Record<keyof typeof NEUTRALS, string> = {
  stone: "#0A1620",
  paper: "#13222E",
  ink: "#EAF1F4",
  muted: "#9FB1BD",
  line: "#243746",
  control: "#6E8494",
  danger: "#FF8A7A",
};

/**
 * Text on the ink button, text on the pastel calendar colors and the brand
 * mark (spec 011 RF-10, plan D5): pastel text never flips. The mark is the
 * coral tile in both themes (spec 025 RF-7): it does not follow the accent.
 */
export const BRAND = { tile: "#CF3D25", onTile: "#FFFFFF" } as const;

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
    dark: "#0A1620",
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
    soft: "0 1px 2px rgb(14 34 51 / 0.06), 0 1px 1px rgb(14 34 51 / 0.04)",
    float:
      "0 18px 40px -8px rgb(14 34 51 / 0.22), 0 4px 12px rgb(14 34 51 / 0.08)",
  },
  dark: {
    soft: "0 1px 2px rgb(0 0 0 / 0.4)",
    float: "0 18px 40px -8px rgb(0 0 0 / 0.6), 0 4px 12px rgb(0 0 0 / 0.35)",
  },
} as const;

export const ACCENTS: readonly Accent[] = [
  {
    id: "red",
    label: "Coral",
    fill: "#CF3D25",
    onFill: WHITE,
    ink: "#B8351F",
    edge: "#CF3D25",
    dark: { ink: "#FF8E78", edge: "#CF3D25" },
  },
  {
    id: "blue",
    label: "Mar",
    fill: "#1668C4",
    onFill: WHITE,
    ink: "#1257A6",
    edge: "#1668C4",
    dark: { ink: "#7DB7FF", edge: "#7DB7FF" },
  },
  {
    id: "green",
    label: "Alga",
    fill: "#1F7A4D",
    onFill: WHITE,
    ink: "#1A6A42",
    edge: "#1F7A4D",
    dark: { ink: "#5AD696", edge: "#1F7A4D" },
  },
  {
    id: "yellow",
    label: "Sol",
    fill: "#FFC83D",
    onFill: NEUTRALS.ink,
    ink: "#7A5200",
    edge: "#7A5200",
    dark: { ink: "#FFC83D", edge: "#FFC83D" },
  },
  {
    id: "purple",
    label: "Lavanda",
    fill: "#6D4BD1",
    onFill: WHITE,
    ink: "#5B3CB8",
    edge: "#6D4BD1",
    dark: { ink: "#B9A3FF", edge: "#B9A3FF" },
  },
  {
    id: "gray",
    label: "Roca",
    fill: "#3D4F5C",
    onFill: WHITE,
    ink: "#3D4F5C",
    edge: "#3D4F5C",
    dark: { ink: "#B4C2CC", edge: "#B4C2CC" },
  },
];

export function isAccent(value: unknown): value is AccentId {
  return ACCENT_IDS.some((id) => id === value);
}
