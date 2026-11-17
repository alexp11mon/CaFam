import { describe, expect, it } from "vitest";
import {
  createVerdict,
  same,
  verdict,
  verdictOrGone,
} from "@/lib/offline/conflict";

const event = (title: string, startsAt = "2026-11-20T09:00:00.000Z") => ({
  title,
  calendarId: "cal",
  allDay: false,
  startsAt,
  endsAt: "2026-11-20T10:00:00.000Z",
  description: null as string | null | undefined,
  location: null,
  color: null,
  categoryId: null,
});

describe("verdict (spec 034 RF-41, RF-50, plan D5)", () => {
  const base = event("Cena");
  const mine = event("Cena con Ana");

  it("applies when nobody else touched it", () => {
    expect(verdict(base, mine, base)).toBe("apply");
  });

  it("is already applied when the server has my version (a resend)", () => {
    expect(verdict(base, mine, mine)).toBe("applied");
  });

  it("asks when someone else changed it", () => {
    expect(verdict(base, mine, event("Cena en casa"))).toBe("conflict");
  });

  it("compares instants, not their format", () => {
    const server = { ...base, startsAt: "2026-11-20T09:00:00+00:00" };
    expect(verdict(base, mine, server)).toBe("apply");
  });

  it("takes null and an empty text as the same", () => {
    expect(same(base, { ...base, location: "" }, base)).toBe(true);
  });

  it("leaves out the description a partial event does not know (R6)", () => {
    const partial = { ...base, description: undefined };
    const server = { ...base, description: "Llevar vino" };
    expect(verdict(partial, { ...mine, description: undefined }, server)).toBe(
      "apply",
    );
  });
});

describe("verdictOrGone (RF-51, RF-52)", () => {
  const base = event("Cena");

  it("asks when changing what someone else deleted", () => {
    expect(verdictOrGone(base, event("Otra"), null)).toBe("conflict");
  });

  it("is done when deleting what is already gone", () => {
    expect(verdictOrGone(base, null, null)).toBe("applied");
  });

  it("deletes what nobody changed and asks when it changed", () => {
    expect(verdictOrGone(base, null, base)).toBe("apply");
    expect(verdictOrGone(base, null, event("Cambiada"))).toBe("conflict");
  });
});

describe("createVerdict (RF-41)", () => {
  it("creates when missing and is done when already there", () => {
    const mine = event("Nuevo");
    expect(createVerdict(mine, null)).toBe("apply");
    expect(createVerdict(mine, mine)).toBe("applied");
  });
});

describe("notes and items (RF-53 to RF-55)", () => {
  const note = {
    title: "Compra",
    body: "",
    color: null,
    pinned: false,
    archived: false,
    dueDate: null,
  };

  it("asks when another person changed a field of the note", () => {
    expect(
      verdict(note, { ...note, pinned: true }, { ...note, title: "Súper" }),
    ).toBe("conflict");
  });

  it("does not mix different items: each is compared on its own", () => {
    const pan = { text: "Pan", done: false };
    // I ticked "Pan"; someone else edited "Leche": "Pan" on the server is as I found it.
    expect(verdict(pan, { ...pan, done: true }, pan)).toBe("apply");
  });

  it("asks when both changed the same item", () => {
    const pan = { text: "Pan", done: false };
    expect(
      verdict(
        pan,
        { ...pan, done: true },
        { text: "Pan integral", done: false },
      ),
    ).toBe("conflict");
  });
});
