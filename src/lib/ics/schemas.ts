import { DEFAULT_CALENDAR_COLOR, isPaletteColor } from "@/lib/calendar/palette";
import type { ParseResult } from "@/lib/forms/form-state";

export type ImportField = "url" | "file" | "name" | "color";

export interface ImportFormInput {
  url: string;
  /** Whether a file was chosen. */
  hasFile: boolean;
  name: string;
  color: string;
}

export interface ImportFormData {
  source: { kind: "url"; url: string } | { kind: "file" };
  /** Null means "use the name of the .ics" (RF-9). */
  name: string | null;
  color: string;
}

const SOURCE_MESSAGE = "Indica un enlace o sube un archivo, no los dos.";
const NAME_MESSAGE = "Escribe un nombre de 1 a 50 caracteres.";
const COLOR_MESSAGE = "Elige uno de los colores de la paleta.";

/**
 * Validates the import form: exactly one of link and file (RF-1, RF-2), an
 * optional name of up to 50 characters (RF-8) and a palette color (RF-10).
 */
export function parseImportForm(
  input: ImportFormInput,
): ParseResult<ImportFormData, ImportField> {
  const errors: Partial<Record<ImportField, string>> = {};

  const url = input.url.trim();
  if ((url !== "") === input.hasFile) errors.url = SOURCE_MESSAGE;

  const name = input.name.trim();
  if (Array.from(name).length > 50) errors.name = NAME_MESSAGE;

  const color = input.color.trim();
  if (color !== "" && !isPaletteColor(color)) errors.color = COLOR_MESSAGE;

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    data: {
      source: input.hasFile ? { kind: "file" } : { kind: "url", url },
      name: name === "" ? null : name,
      color: color === "" ? DEFAULT_CALENDAR_COLOR : color.toUpperCase(),
    },
  };
}
