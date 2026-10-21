// Closed color palette for calendars and events (spec 002 RF-2, plan D13).

export interface PaletteColor {
  value: string;
  label: string;
}

/** Pastel, clean colors plus the brand blue every spec 001 calendar already uses. */
export const CALENDAR_COLORS: readonly PaletteColor[] = [
  { value: "#2563EB", label: "Azul marca" },
  { value: "#FFADAD", label: "Coral" },
  { value: "#FFD6A5", label: "Melocotón" },
  { value: "#FDFFB6", label: "Limón" },
  { value: "#CAFFBF", label: "Menta" },
  { value: "#9BF6FF", label: "Turquesa" },
  { value: "#A0C4FF", label: "Azul cielo" },
  { value: "#BDB2FF", label: "Lavanda" },
  { value: "#FFC6FF", label: "Orquídea" },
  { value: "#FFB5A7", label: "Salmón" },
  { value: "#B5EAD7", label: "Aguamarina" },
  { value: "#C7CEEA", label: "Pervinca" },
  { value: "#E2F0CB", label: "Pistacho" },
  { value: "#F7D6E0", label: "Rosa suave" },
];

export const DEFAULT_CALENDAR_COLOR = "#2563EB";

const INK = "#0D160B";
const WHITE = "#FFFFFF";

export function isPaletteColor(value: string): boolean {
  const normalized = value.toUpperCase();
  return CALENDAR_COLORS.some((color) => color.value === normalized);
}

function channelToLinear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const red = channelToLinear(Number.parseInt(hex.slice(1, 3), 16));
  const green = channelToLinear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = channelToLinear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG contrast ratio between two `#RRGGBB` colors. */
export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** White or ink, whichever reads better on `background` (RNF contrast ≥ 4.5:1). */
export function readableTextColor(background: string): string {
  return contrastRatio(WHITE, background) >= contrastRatio(INK, background)
    ? WHITE
    : INK;
}
