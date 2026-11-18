import type { ChatMessage } from "./schemas";

// Spec 036, plan D2 and D5. Pure: whether the user asked to write, and the
// short answers to a pending change.

/** Lowercase, without accents nor punctuation, words split by spaces. */
export function plainWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.:\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Word starts of "create" and "change" in Spanish, imperative included
// ("créame", "pásalo", "apúntame"). Deleting stays out: Venito never deletes
// (RF-31) and answers that with the read tools.
const WRITE_STEMS = [
  "crea",
  "crear",
  "anad",
  "apunt",
  "pon",
  "agend",
  "reserv",
  "program",
  "mete",
  "cambi",
  "mueve",
  "mover",
  "muevel",
  "pasal",
  "pasam",
  "retras",
  "adelant",
  "renombr",
  "edit",
  "modific",
  "corrig",
  "alarg",
  "acort",
];

const hasWriteVerb = (text: string) =>
  plainWords(text).some((word) =>
    WRITE_STEMS.some((stem) => word.startsWith(stem)),
  );

/** How many user messages back a request is followed while Venito asks. */
const FOLLOW_BACK = 3;

/** Venito asked something: "¿En qué calendario lo creo? Puedes elegir: …". */
const asks = (message: ChatMessage | undefined) =>
  message?.role === "assistant" && message.content.includes("?");

/**
 * RF-40, RF-45: the last user message asks to create or change, or answers
 * a question Venito asked about such a request. Only the user's own words
 * count: Venito's answers and the data of events never do.
 */
export function wantsWrite(thread: readonly ChatMessage[]): boolean {
  let index = thread.findLastIndex((message) => message.role === "user");
  for (let seen = 0; index >= 0 && seen < FOLLOW_BACK; seen++) {
    if (hasWriteVerb(thread[index]!.content)) return true;
    // Followed only while each earlier step was a question of Venito.
    if (!asks(thread[index - 1])) return false;
    index -= 2;
    if (thread[index]?.role !== "user") return false;
  }
  return false;
}

const YES = new Set([
  "si",
  "vale",
  "ok",
  "okay",
  "adelante",
  "confirmo",
  "confirma",
  "confirmar",
  "hazlo",
  "de acuerdo",
  "claro",
  "perfecto",
  "venga",
  "correcto",
]);
const YES_TAIL = new Set(["", "por favor", "hazlo", "adelante", "gracias"]);

const NO = new Set([
  "no",
  "cancela",
  "cancelalo",
  "dejalo",
  "mejor no",
  "no gracias",
  "olvidalo",
  "nada",
  "no lo cambies",
]);

const plain = (text: string) =>
  plainWords(text.replace(/[.:]/g, " ")).join(" ");

/** RF-24a: a plain "sí" confirms; "sí, pero a las 19:00" is a correction. */
export function isYes(text: string): boolean {
  if (/[0-9]/.test(text)) return false;
  const words = plain(text);
  for (const head of YES) {
    if (words === head) return true;
    if (words.startsWith(`${head} `)) {
      return YES_TAIL.has(words.slice(head.length + 1));
    }
  }
  return false;
}

/** RF-24b: a plain "no" cancels; "no, mejor a las 19:00" is a correction. */
export function isNo(text: string): boolean {
  return NO.has(plain(text));
}
