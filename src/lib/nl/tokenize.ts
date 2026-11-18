// The text of a new event, scanned by the recognizers of spec 041 (plan D1).
// Pure. The normalized text keeps the length of the original, so every match
// is also a span of what the user wrote (to highlight it, RF-11).

export type SpanKind =
  "date" | "time" | "duration" | "allDay" | "location" | "calendar" | "repeat";

export interface Span {
  start: number;
  end: number;
  kind: SpanKind;
}

/** Lower case without accents, one character for one character; ñ stays. */
export function normalizeText(text: string): string {
  let out = "";
  for (const char of text) {
    const lower = char.toLowerCase();
    const plain =
      lower === "ñ" ? lower : lower.normalize("NFD").replace(/\p{M}/gu, "");
    // Never change the length: the spans point into the original.
    out += plain.length === char.length ? plain : char;
  }
  return out;
}

/** A word boundary that knows letters with accents and digits. */
export const B = "(?<![\\p{L}\\p{N}])";
export const E = "(?![\\p{L}\\p{N}])";

/** Small numbers in words ("dentro de dos días", "media hora" apart). */
export const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  quince: 15,
  veinte: 20,
  treinta: 30,
};

export const NUMBER = `(?:\\d{1,3}|${Object.keys(NUMBER_WORDS).join("|")})`;

export function readNumber(raw: string): number {
  return NUMBER_WORDS[raw] ?? Number(raw);
}

export class Scan {
  readonly original: string;
  readonly norm: string;
  readonly spans: Span[] = [];
  private readonly taken: boolean[];

  constructor(text: string) {
    this.original = text;
    this.norm = normalizeText(text);
    this.taken = Array.from({ length: text.length }, () => false);
  }

  private free(start: number, end: number): boolean {
    for (let i = start; i < end; i += 1) if (this.taken[i]) return false;
    return true;
  }

  /**
   * The first match of `source` over free text that `accept` turns into a
   * value; its span is then taken. A refused match leaves the text free.
   */
  first<T>(
    source: string,
    kind: SpanKind,
    accept: (match: RegExpExecArray) => T | null,
  ): T | null {
    const pattern = new RegExp(source, "gu");
    for (const match of this.norm.matchAll(pattern)) {
      const start = match.index;
      let end = start + match[0].length;
      while (end > start && this.norm[end - 1] === " ") end -= 1;
      if (end === start || !this.free(start, end)) continue;
      const value = accept(match as RegExpExecArray);
      if (value === null) continue;
      this.mark(start, end, kind);
      return value;
    }
    return null;
  }

  mark(start: number, end: number, kind: SpanKind): void {
    for (let i = start; i < end; i += 1) this.taken[i] = true;
    this.spans.push({ start, end, kind });
  }

  /** The runs of text no recognizer took, in order. */
  runs(): { start: number; end: number }[] {
    const runs: { start: number; end: number }[] = [];
    let start = -1;
    for (let i = 0; i <= this.original.length; i += 1) {
      const isFree = i < this.original.length && !this.taken[i];
      if (isFree && start < 0) start = i;
      if (!isFree && start >= 0) {
        runs.push({ start, end: i });
        start = -1;
      }
    }
    return runs;
  }
}
