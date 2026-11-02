// Finds a person by the name they have in CaFam (spec 015 RF-15, RF-16).

export interface NamedPerson {
  id: string;
  name: string;
}

export type PersonMatch =
  | { status: "ok"; person: NamedPerson }
  | { status: "ambiguous"; name: string; options: string[] }
  | { status: "not_found"; name: string };

const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

/** Every word asked for starts a word of the name, in order: "ana" or "ana mar". */
function matches(query: string[], name: string[]): boolean {
  let at = 0;
  for (const word of query) {
    while (at < name.length && !name[at]!.startsWith(word)) at++;
    if (at === name.length) return false;
    at++;
  }
  return true;
}

export function matchPerson(
  name: string,
  people: readonly NamedPerson[],
): PersonMatch {
  const query = words(name);
  const exact = people.filter(
    (person) => words(person.name).join(" ") === query.join(" "),
  );
  const found =
    exact.length > 0
      ? exact
      : people.filter((person) => matches(query, words(person.name)));
  if (found.length === 1) return { status: "ok", person: found[0]! };
  if (found.length === 0) return { status: "not_found", name };
  return {
    status: "ambiguous",
    name,
    options: found.map((person) => person.name).sort(),
  };
}
