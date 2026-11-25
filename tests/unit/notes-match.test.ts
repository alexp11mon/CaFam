import { describe, expect, it } from "vitest";
import { matchNote } from "@/lib/notes/match";

// Spec 048 RF-13: the note named in the chat, without accents or capitals.
const NOTES = [
  { id: "a", title: "Lista de la compra" },
  { id: "b", title: "Regalos de Navidad" },
  { id: "c", title: "Regalos cumpleaños" },
  { id: "d", title: "" },
];

describe("matchNote", () => {
  it("finds a note by its words, whatever the accents and capitals", () => {
    expect(matchNote("la lista de la COMPRA", NOTES)).toEqual({
      status: "ok",
      note: NOTES[0],
    });
    expect(matchNote("compra", NOTES)).toMatchObject({ note: { id: "a" } });
    expect(matchNote("regalos de navidad", NOTES)).toMatchObject({
      note: { id: "b" },
    });
    expect(matchNote("Regalos Cumpleanos", NOTES)).toMatchObject({
      note: { id: "c" },
    });
  });

  it("asks when several fit and says so when none does", () => {
    expect(matchNote("regalos", NOTES)).toEqual({
      status: "ambiguous",
      options: ["Regalos cumpleaños", "Regalos de Navidad"],
    });
    expect(matchNote("deberes", NOTES)).toEqual({
      status: "not_found",
      name: "deberes",
    });
    expect(matchNote("  ", NOTES)).toEqual({ status: "not_found", name: "" });
  });
});
