// Spec 053 plan D7: the Spanish text is the key; only English has a catalog.

export type Messages = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;
export type T = (text: string, vars?: Vars) => string;

/** Puts the values in {name} placeholders; unknown names stay as they are. */
export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** Without messages (Spanish), the text itself; with them, its translation or the text. */
export function makeT(messages: Messages | null): T {
  return (text, vars) => interpolate(messages?.[text] ?? text, vars);
}

/** The Spanish identity, for code outside any provider. */
export const spanishT: T = makeT(null);
