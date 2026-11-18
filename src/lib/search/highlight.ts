import { normalizeChar, queryTerms } from "./normalize";

export interface Segment {
  text: string;
  mark: boolean;
}

/** Normalized text and, for each of its characters, its index in `text`. */
function mapped(text: string): { flat: string; origin: number[] } {
  let flat = "";
  const origin: number[] = [];
  [...text].reduce((index, char) => {
    const normal = normalizeChar(char);
    flat += normal;
    for (let i = 0; i < normal.length; i += 1) origin.push(index);
    return index + char.length;
  }, 0);
  return { flat, origin };
}

/** Ranges [start, end) of `text` that match a word of `query`. */
function ranges(text: string, query: string): [number, number][] {
  const { flat, origin } = mapped(text);
  const found: [number, number][] = [];
  for (const term of queryTerms(query)) {
    let at = flat.indexOf(term);
    while (at !== -1) {
      const last = origin[at + term.length - 1];
      const end = last + (text.codePointAt(last)! > 0xffff ? 2 : 1);
      found.push([origin[at], end]);
      at = flat.indexOf(term, at + term.length);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of found) {
    const prev = merged.at(-1);
    if (prev && range[0] <= prev[1]) prev[1] = Math.max(prev[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** The text cut into marked and plain pieces (spec 039 RF-7). */
export function highlight(text: string, query: string): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  for (const [start, end] of ranges(text, query)) {
    if (start > at) segments.push({ text: text.slice(at, start), mark: false });
    segments.push({ text: text.slice(start, end), mark: true });
    at = end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), mark: false });
  return segments;
}

/** A piece of a long comment around its first match. */
export function excerpt(text: string, query: string, radius = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= radius * 2) return flat;
  const first = ranges(flat, query)[0]?.[0] ?? 0;
  const start = Math.max(0, first - radius);
  const end = Math.min(flat.length, first + radius);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}
