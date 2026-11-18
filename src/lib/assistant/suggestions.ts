// The quick suggestions over the chat's input (spec 027 RF-5, plan D4). Pure.

export interface Suggestion {
  label: string;
  /**
   * `send` asks it at once; `fill` writes `text` in the field and leaves the
   * cursor after it, for what needs a name or a date; `attach` opens the
   * image picker.
   */
  kind: "send" | "fill" | "attach";
  /** What is sent or written; the label when left out. */
  text?: string;
}

const EMPTY: Suggestion[] = [
  { label: "¿Qué tengo hoy?", kind: "send" },
  { label: "¿Qué tengo esta semana?", kind: "send" },
  { label: "¿Cuándo estamos todos libres?", kind: "send" },
  // Spec 036 RF-47.
  { label: "Crear un evento", kind: "fill", text: "Crea un evento " },
  { label: "Buscar un evento", kind: "fill", text: "Busca el evento " },
  { label: "Crear eventos desde una foto", kind: "attach" },
  { label: "¿Qué se ha comentado últimamente?", kind: "send" },
];

const AFTER_ANSWER: Suggestion[] = [
  { label: "¿Y mañana?", kind: "send" },
  { label: "¿Qué tardes tengo libres esta semana?", kind: "send" },
  { label: "Crear un evento", kind: "fill", text: "Crea un evento " },
  { label: "Buscar un evento", kind: "fill", text: "Busca el evento " },
];

const WITH_IMAGE: Suggestion[] = [
  { label: "Crea estos eventos", kind: "send" },
  { label: "Solo los turnos de…", kind: "fill", text: "Solo los turnos de " },
  { label: "Es el horario de la semana que viene", kind: "send" },
];

/** The chips for where the conversation is. */
export function suggestionsFor({
  messages,
  attachments,
}: {
  /** How many messages the thread has. */
  messages: number;
  /** How many images wait to be sent. */
  attachments: number;
}): Suggestion[] {
  if (attachments > 0) return WITH_IMAGE;
  return messages === 0 ? EMPTY : AFTER_ANSWER;
}

/** What a chip sends or writes. */
export function suggestionText(suggestion: Suggestion): string {
  return suggestion.text ?? suggestion.label;
}
