// The search criterion (spec 039 RF-3): no case, no accents, ñ kept. It must
// match public.search_text in SQL, which protects ñ around unaccent.
const KEEP_ENYE = "\u0001";

/** Lower case without accents (ñ kept) and with single spaces. */
export function normalize(text: string): string {
  return normalizeChar(text).replace(/\s+/g, " ").trim();
}

/** Like `normalize` without touching spaces, for one character at a time. */
export function normalizeChar(text: string): string {
  return text
    .toLowerCase()
    .replaceAll("ñ", KEEP_ENYE)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replaceAll(KEEP_ENYE, "ñ");
}

/** The normalized words of a query. */
export function queryTerms(query: string): string[] {
  const text = normalize(query);
  return text ? text.split(" ") : [];
}

/** Every word appears in the text, as a word, prefix or part (plan D1). */
export function matchesAll(text: string, terms: string[]): boolean {
  if (terms.length === 0) return false;
  const haystack = normalize(text);
  return terms.every((term) => haystack.includes(term));
}
