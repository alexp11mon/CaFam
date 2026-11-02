// Short references [eN] instead of event ids (spec 015 RF-11, RF-13, RF-30,
// plan D5): the model cites them and only the ones handed out by the tools
// become events in the answer.

export interface Refs<T> {
  add(item: T): string;
  get(ref: string): T | undefined;
}

export function createRefs<T>(): Refs<T> {
  const items = new Map<string, T>();
  return {
    add(item) {
      const ref = `e${items.size + 1}`;
      items.set(ref, item);
      return ref;
    },
    get: (ref) => items.get(ref),
  };
}

// The model sometimes writes "[ e1 ]", with (non-breaking) spaces inside.
const MARKER = /\s*\[\s*(e\d+(?:\s*,\s*e\d+)*)\s*\]/g;

export function extractCitations<T>(
  answer: string,
  refs: Refs<T>,
): { text: string; cited: T[] } {
  const cited: T[] = [];
  const text = answer.replace(MARKER, (_, list: string) => {
    for (const ref of list.split(",")) {
      const item = refs.get(ref.trim());
      if (item !== undefined && !cited.includes(item)) cited.push(item);
    }
    return "";
  });
  return { text: text.replace(/[ \t]+$/gm, "").trim(), cited };
}
