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

export const ACCENTS: readonly Accent[] = [
  {
    id: "red",
    label: "Rojo",
    fill: "#D92D20",
    onFill: WHITE,
    ink: "#B42318",
    edge: "#D92D20",
  },
  {
    id: "blue",
    label: "Azul",
    fill: "#2563EB",
    onFill: WHITE,
    ink: "#1D4ED8",
    edge: "#2563EB",
  },
  {
    id: "green",
    label: "Verde",
    fill: "#1F7A4A",
    onFill: WHITE,
    ink: "#186A3F",
    edge: "#1F7A4A",
  },
  {
    id: "yellow",
    label: "Amarillo",
    fill: "#F5C518",
    onFill: NEUTRALS.ink,
    ink: "#7A5C00",
    edge: "#7A5C00",
  },
  {
    id: "purple",
    label: "Morado",
    fill: "#7C4DCC",
    onFill: WHITE,
    ink: "#6B3FBF",
    edge: "#7C4DCC",
  },
  {
    id: "gray",
    label: "Gris",
    fill: "#5F5C55",
    onFill: WHITE,
    ink: "#5F5C55",
    edge: "#5F5C55",
  },
];

export function isAccent(value: unknown): value is AccentId {
  return ACCENT_IDS.some((id) => id === value);
}

export const accentSchema = z.enum(ACCENT_IDS, {
  error: "Elige uno de los colores disponibles.",
});
