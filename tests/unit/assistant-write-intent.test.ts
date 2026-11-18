import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/assistant/schemas";
import { isNo, isYes, wantsWrite } from "@/lib/assistant/write-intent";

// Spec 036, T1: the write tools are only offered when the user asks to write
// (RF-40, RF-45, plan D2), and a short "sí"/"no" answers a pending change
// without the model (RF-24a, RF-24b, plan D5).

const user = (content: string): ChatMessage => ({ role: "user", content });
const venito = (content: string): ChatMessage => ({
  role: "assistant",
  content,
});

describe("wantsWrite", () => {
  it.each([
    "Crea un evento que se llame Comida Uni mañana a las 14:00",
    "créame una cita con el dentista el jueves",
    "Añade Fútbol el sábado a las 10",
    "Apúntame la reunión el lunes",
    "Pon Comida Uni cuando acabe PIAE",
    "Agenda una llamada mañana",
    "Cambia la hora del dentista a las 18:00",
    "Mueve PIAE al viernes",
    "Pásalo a las 19:00",
    "Renombra el evento de mañana",
    "Retrasa la cena media hora",
    "Edita Comida Uni",
  ])("offers writing for «%s»", (text) => {
    expect(wantsWrite([user(text)])).toBe(true);
  });

  it.each([
    "¿Qué tengo mañana?",
    "¿Cuándo es el cumpleaños de Ana?",
    "¿Qué tardes tenemos libres Luis y yo?",
    "¿Qué se ha comentado de la cena?",
  ])("does not offer writing for «%s»", (text) => {
    expect(wantsWrite([user(text)])).toBe(false);
  });

  it("follows a request while Venito keeps asking (RF-45)", () => {
    expect(
      wantsWrite([
        user("Crea Comida Uni el jueves"),
        venito("¿A qué hora empieza?"),
        user("a las 13:30"),
        venito("¿En qué calendario lo creo? Puedes elegir: Familia, Uni."),
        user("en Uni"),
      ]),
    ).toBe(true);
  });

  it("stops following once Venito answered without asking", () => {
    expect(
      wantsWrite([
        user("Crea Comida Uni el jueves a las 13:30"),
        venito("He creado Comida Uni el jueves de 13:30 a 14:30."),
        user("¿Qué más tengo ese día?"),
      ]),
    ).toBe(false);
  });

  it("looks at most 3 user messages back", () => {
    expect(
      wantsWrite([
        user("Crea un evento"),
        venito("¿Cómo se llama?"),
        user("Comida"),
        venito("¿Qué día?"),
        user("el jueves"),
        venito("¿A qué hora?"),
        user("a las 13:30"),
      ]),
    ).toBe(false);
  });

  it("never reads the write verb from Venito's own words (RF-40)", () => {
    expect(
      wantsWrite([
        user("¿Qué tengo mañana?"),
        venito("[Creado: Comida Uni, jueves] ¿Quieres que lo cambie?"),
        user("¿Y el viernes?"),
      ]),
    ).toBe(false);
  });

  it("is false without a user message", () => {
    expect(wantsWrite([])).toBe(false);
  });
});

describe("isYes and isNo", () => {
  it.each([
    "sí",
    "Si",
    "vale",
    "Ok",
    "adelante",
    "Sí, hazlo",
    "confirmo",
    "de acuerdo",
    "sí por favor",
  ])("«%s» confirms", (text) => {
    expect(isYes(text)).toBe(true);
    expect(isNo(text)).toBe(false);
  });

  it.each(["no", "No.", "cancela", "déjalo", "mejor no", "no, gracias"])(
    "«%s» cancels",
    (text) => {
      expect(isNo(text)).toBe(true);
      expect(isYes(text)).toBe(false);
    },
  );

  it.each([
    "sí, pero a las 19:00",
    "no, mejor a las 19:00",
    "mejor el viernes",
    "¿y el sábado?",
  ])("«%s» is neither: it goes to Venito", (text) => {
    expect(isYes(text)).toBe(false);
    expect(isNo(text)).toBe(false);
  });
});
