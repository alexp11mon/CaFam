// RFC 5545 text helpers for writing .ics (spec 043 RNF-1). Pure.

/** Escapes a TEXT value: backslash, semicolon, comma and line breaks. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Folds a content line at 75 octets, never inside a UTF-8 character. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const length = encoder.encode(char).length;
    // Continuation lines start with a space, which counts.
    const max = parts.length === 0 ? 75 : 74;
    if (size + length > max) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += length;
  }
  parts.push(current);
  return parts.join("\r\n ");
}
