import { spanishT, type T } from "@/lib/i18n/translate";
// The undo and redo stack of the tab (spec 046 RF-11 to RF-16, plan D4).
// Pure: each entry carries a step that undoes it and answers with the step
// that redoes it, and the other way round. Lives only in memory.

export type StepResult =
  { ok: true; inverse?: Step } | { ok: false; error: string };

export type Step = () => Promise<StepResult>;

export interface StackEntry {
  /** "mover «Dentista»": the notice says "Deshecho: …" (RF-12). */
  label: string;
  step: Step;
}

export interface UndoStack {
  undo: readonly StackEntry[];
  redo: readonly StackEntry[];
}

export const STACK_LIMIT = 20;

export const EMPTY_STACK: UndoStack = { undo: [], redo: [] };

/** A new action: on top, the oldest out past 20; nothing left to redo (RF-11). */
export function pushAction(stack: UndoStack, entry: StackEntry): UndoStack {
  return { undo: [...stack.undo, entry].slice(-STACK_LIMIT), redo: [] };
}

/** Takes the entry on top of one side, or null when it is empty. */
export function take(
  stack: UndoStack,
  side: "undo" | "redo",
): { entry: StackEntry; stack: UndoStack } | null {
  const list = stack[side];
  const entry = list.at(-1);
  if (!entry) return null;
  return { entry, stack: { ...stack, [side]: list.slice(0, -1) } };
}

/**
 * After running a taken entry: its inverse goes to the other side. A failure
 * (someone changed the event, RF-13) or a step without inverse leaves it out.
 */
export function settle(
  stack: UndoStack,
  side: "undo" | "redo",
  entry: StackEntry,
  result: StepResult,
): UndoStack {
  if (!result.ok || !result.inverse) return stack;
  const other = side === "undo" ? "redo" : "undo";
  return {
    ...stack,
    [other]: [
      ...stack[other],
      { label: entry.label, step: result.inverse },
    ].slice(-STACK_LIMIT),
  };
}

// The notices of the actions (spec 017 UNDO_NOTICES and the quick create),
// as the verb of "Deshecho: mover «Dentista»".
const VERBS: Record<string, string> = {
  "Evento movido": "mover",
  "Duración cambiada": "cambiar la duración",
  "Color cambiado": "cambiar el color",
  "Evento borrado": "borrar",
  "Evento pegado": "pegar",
  "Evento creado": "crear",
  "Evento duplicado": "duplicar",
};

/** "mover «Dentista»", or the notice itself when it is not an action of the list. */
export function undoLabel(
  notice: string,
  title?: string,
  t: T = spanishT,
): string {
  const known = VERBS[notice];
  const text = t(known ?? notice);
  const verb = known ? text : text.charAt(0).toLowerCase() + text.slice(1);
  return title ? t("{verb} «{title}»", { verb, title }) : verb;
}
