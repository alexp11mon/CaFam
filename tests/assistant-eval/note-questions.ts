import type { AssistantAction } from "@/lib/assistant/actions";
import { says, type Check, type EvalResult } from "./questions";
import type { WriteQuestion } from "./write-questions";

// Spec 048, T6 (RNF-3): notes with Venito, against what the eval seeds for
// them: a list "Lista de la compra" with "huevos" pending and "arroz" done.

const notes = (actions: AssistantAction[] = []) =>
  actions.flatMap((action) => (action.kind === "note" ? [action] : []));

/** One note card, new or added to, with these items. */
const writesNote =
  (expected: { title: RegExp; added: boolean; items: string[] }): Check =>
  ({ actions }: EvalResult) => {
    const all = notes(actions);
    if (all.length !== 1) return `escribe ${all.length} notas`;
    const { note, added } = all[0]!;
    const items = note.items.map((item) => item.toLowerCase());
    const wrong = [
      expected.title.test(note.title) ? null : `nota ${note.title}`,
      added === expected.added ? null : added ? "añade" : "crea",
      expected.items.every((item) => items.some((it) => it.includes(item)))
        ? null
        : `elementos ${note.items.join(", ")}`,
    ].filter(Boolean);
    return wrong.length ? `nota mal: ${wrong.join(", ")}` : null;
  };

const writesNothing: Check = ({ actions }) =>
  actions?.length ? `escribe ${actions.length}` : null;

export const NOTE_QUESTIONS: WriteQuestion[] = [
  {
    question: "Apunta leche y pan en la lista de la compra",
    checks: [
      writesNote({ title: /compra/i, added: true, items: ["leche", "pan"] }),
    ],
  },
  {
    question: "Crea una lista Maleta con bañador, crema y gafas",
    checks: [
      writesNote({
        title: /maleta/i,
        added: false,
        items: ["ba", "crema", "gafas"],
      }),
    ],
  },
  {
    question: "¿Qué me queda en la lista de la compra?",
    mustNotWrite: true,
    checks: [says(/huevos/), writesNothing],
  },
  {
    question: "Añade tomates a la lista de deberes",
    mustNotWrite: true,
    checks: [says(/\?/), writesNothing],
  },
  {
    question: "Crea una nota Menú con el texto: lunes lentejas, martes pasta",
    checks: [writesNote({ title: /men[uú]/i, added: false, items: [] })],
  },
];
