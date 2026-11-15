import { describe, expect, it } from "vitest";
import { QUESTION_MAX } from "@/lib/assistant/limits";
import { suggestionsFor, suggestionText } from "@/lib/assistant/suggestions";

// Spec 027, T2 (RF-5, plan D4).
const labels = (messages: number, attachments = 0) =>
  suggestionsFor({ messages, attachments }).map((s) => s.label);

describe("suggestionsFor", () => {
  it("offers the six starters in an empty conversation", () => {
    expect(labels(0)).toEqual([
      "¿Qué tengo hoy?",
      "¿Qué tengo esta semana?",
      "¿Cuándo estamos todos libres?",
      "Buscar un evento",
      "Crear eventos desde una foto",
      "¿Qué se ha comentado últimamente?",
    ]);
  });

  it("changes after an answer", () => {
    expect(labels(2)).toEqual([
      "¿Y mañana?",
      "¿Qué tardes tengo libres esta semana?",
      "Buscar un evento",
    ]);
  });

  it("is about the image while one is attached, whatever the thread", () => {
    expect(labels(0, 1)).toEqual(labels(4, 2));
    expect(labels(0, 1)[0]).toBe("Crea estos eventos");
  });

  it("sends whole questions, fills what needs a name and attaches for the photo", () => {
    const all = [
      ...suggestionsFor({ messages: 0, attachments: 0 }),
      ...suggestionsFor({ messages: 2, attachments: 0 }),
      ...suggestionsFor({ messages: 0, attachments: 1 }),
    ];
    for (const suggestion of all) {
      const text = suggestionText(suggestion);
      expect(text.length).toBeLessThanOrEqual(QUESTION_MAX);
      if (suggestion.kind === "fill") {
        // Ends with a space: the cursor is left where the name goes.
        expect(text.endsWith(" ")).toBe(true);
      }
      if (suggestion.kind === "send") expect(text).toBe(suggestion.label);
    }
    expect(all.filter((s) => s.kind === "attach").map((s) => s.label)).toEqual([
      "Crear eventos desde una foto",
    ]);
  });
});
