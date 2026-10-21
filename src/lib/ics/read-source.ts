import type { ImportError } from "./error-messages";
import { MAX_BYTES } from "./limits";
import { parseSourceUrl } from "./source-url";

export type IcsSource =
  { kind: "text"; text: string } | { kind: "url"; url: URL };
export type ReadSourceResult =
  { ok: true; source: IcsSource } | { ok: false; error: ImportError };

/** The file chosen in the form, or null: browsers send an empty one when nothing was chosen. */
export function getFile(formData: FormData): File | null {
  const value = formData.get("file");
  return value instanceof File && value.size > 0 ? value : null;
}

/**
 * Picks the source of the import: the file if there is one, else the link
 * (RF-1, RF-2). A file over 2 MB is rejected without being read (RF-26). The
 * form validation has already asked for exactly one of them.
 */
export async function readIcsSource(
  formData: FormData,
): Promise<ReadSourceResult> {
  const file = getFile(formData);
  if (file) {
    if (file.size > MAX_BYTES)
      return { ok: false, error: { kind: "too-large" } };
    return { ok: true, source: { kind: "text", text: await file.text() } };
  }

  const raw = formData.get("url");
  const checked = parseSourceUrl(typeof raw === "string" ? raw : "");
  if (!checked.ok) return { ok: false, error: { kind: "invalid-url" } };
  return { ok: true, source: { kind: "url", url: checked.url } };
}
