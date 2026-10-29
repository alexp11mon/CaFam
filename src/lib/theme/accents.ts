// The interface accents a user can pick and the neutral colors around them
// (spec 005 RF-6, RF-10, RF-14; plan "Modelo de datos", D2). globals.css
// repeats these values as CSS variables and accents.test.ts keeps both equal.
import { z } from "zod";

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
  /** Solid fill (today in the mini month, the next event block). */
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
  stone: "#E8E5DD",
  paper: "#F2F0EA",
  ink: "#141414",
  muted: "#66635D",
  line: "#D6D1C4",
  // Input and select borders need 3:1 against their surface (WCAG 1.4.11).
  control: "#857F75",
  danger: "#B42318",
} as const;

/** The same tokens in the dark theme (spec 011 RF-9, plan "Modelo de datos"). */
export const DARK_NEUTRALS: Record<keyof typeof NEUTRALS, string> = {
  stone: "#171612",
  paper: "#211F1B",
  ink: "#F2F0EA",
  muted: "#A9A59C",
  line: "#36332D",
  control: "#7F796F",
  danger: "#F97066",
};

/**
 * Text on the ink button, text on the pastel calendar colors and the brand
 * mark (spec 011 RF-10, plan D5): pastel text and the mark never flip.
 */
export const THEME_INKS = {
  light: {
    onInk: WHITE,
    pastelInk: NEUTRALS.ink,
    mark: NEUTRALS.ink,
    onMark: NEUTRALS.stone,
  },
  dark: {
    onInk: NEUTRALS.ink,
    pastelInk: NEUTRALS.ink,
    mark: NEUTRALS.ink,
    onMark: NEUTRALS.stone,
  },
} as const;

/** The glass surfaces: paper at this alpha keeps P9 over any background (plan D7). */
export const GLASS = {
  light: { bg: NEUTRALS.paper, alpha: 0.93 },
  dark: { bg: DARK_NEUTRALS.paper, alpha: 0.92 },
} as const;

/** The two stops of the soft gradient behind every screen (spec 011 RF-13). */
export const BACKDROP = {
  light: ["#E8E5DD", "#E4E0D7"],
  dark: ["#171612", "#0F0E0B"],
} as const;

export const ACCENTS: readonly Accent[] = [
  {
    id: "red",
    label: "Rojo",
    fill: "#D92D20",
    onFill: WHITE,
    ink: "#B42318",
    edge: "#D92D20",
    dark: { ink: "#F97066", edge: "#D92D20" },
  },
  {
    id: "blue",
    label: "Azul",
    // A darker blue than the old blue of spec 001 (spec 005 RF-58).
    fill: "#1D4ED8",
    onFill: WHITE,
    ink: "#1E40AF",
    edge: "#1D4ED8",
    dark: { ink: "#8AB4FF", edge: "#8AB4FF" },
  },
  {
    id: "green",
    label: "Verde",
    fill: "#1F7A4A",
    onFill: WHITE,
    ink: "#186A3F",
    edge: "#1F7A4A",
    dark: { ink: "#4FD18B", edge: "#1F7A4A" },
  },
  {
    id: "yellow",
    label: "Amarillo",
    fill: "#F5C518",
    onFill: NEUTRALS.ink,
    ink: "#7A5C00",
    edge: "#7A5C00",
    dark: { ink: "#F5C518", edge: "#F5C518" },
  },
  {
    id: "purple",
    label: "Morado",
    fill: "#7C4DCC",
    onFill: WHITE,
    ink: "#6B3FBF",
    edge: "#7C4DCC",
    dark: { ink: "#B794F6", edge: "#B794F6" },
  },
  {
    id: "gray",
    label: "Gris",
    fill: "#5F5C55",
    onFill: WHITE,
    ink: "#5F5C55",
    edge: "#5F5C55",
    dark: { ink: "#B3AFA6", edge: "#B3AFA6" },
  },
];

export function isAccent(value: unknown): value is AccentId {
  return ACCENT_IDS.some((id) => id === value);
}

export const accentSchema = z.enum(ACCENT_IDS, {
  error: "Elige uno de los colores disponibles.",
});
