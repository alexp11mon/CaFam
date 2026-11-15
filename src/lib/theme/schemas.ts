// Validation of what Ajustes sends, apart from the values the frame reads on
// every screen: zod stays out of the first JS of each page (spec 024 RF-14).
import { z } from "zod";
import { ACCENT_IDS } from "./accents";
import { THEME_IDS } from "./theme";

export const themeSchema = z.enum(THEME_IDS, {
  error: "Elige uno de los temas disponibles.",
});

export const accentSchema = z.enum(ACCENT_IDS, {
  error: "Elige uno de los colores disponibles.",
});
