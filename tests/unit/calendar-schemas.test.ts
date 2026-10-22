import { describe, expect, it } from "vitest";
import {
  calendarSchema,
  categorySchema,
  parseEventInput,
  parseMergeInput,
  type EventFormInput,
} from "@/lib/calendar/schemas";
import { fieldErrorsFromZod } from "@/lib/forms/form-state";

const MADRID = "Europe/Madrid";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

describe("calendarSchema (RF-1, RF-2, RF-4)", () => {
  const valid = { name: "Familia", description: "", color: "#A0C4FF" };

  it("accepts a name of 1 to 50 characters and trims it", () => {
    expect(calendarSchema.safeParse({ ...valid, name: "a" }).success).toBe(
      true,
    );
    expect(
      calendarSchema.safeParse({ ...valid, name: "a".repeat(50) }).success,
    ).toBe(true);
    expect(calendarSchema.parse({ ...valid, name: "  Familia  " }).name).toBe(
      "Familia",
    );
  });

  it("rejects an empty, blank or 51-character name", () => {
    for (const name of ["", "   ", "a".repeat(51)]) {
      const result = calendarSchema.safeParse({ ...valid, name });

      expect(result.success, name).toBe(false);
      if (!result.success) {
        expect(fieldErrorsFromZod(result.error)).toEqual({
          name: "Escribe un nombre de 1 a 50 caracteres.",
        });
      }
    }
  });

  it("turns an empty description into null and limits it to 500", () => {
    expect(calendarSchema.parse(valid).description).toBeNull();
    expect(
      calendarSchema.safeParse({ ...valid, description: "d".repeat(500) })
        .success,
    ).toBe(true);
    const long = calendarSchema.safeParse({
      ...valid,
      description: "d".repeat(501),
    });
    expect(long.success).toBe(false);
  });

  it("only accepts palette colors and stores them in uppercase", () => {
    expect(calendarSchema.parse({ ...valid, color: "#a0c4ff" }).color).toBe(
      "#A0C4FF",
    );
    const result = calendarSchema.safeParse({ ...valid, color: "#123456" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error)).toEqual({
        color: "Elige uno de los colores de la paleta.",
      });
    }
  });
});

describe("categorySchema (RF-9)", () => {
  it("accepts 1 to 40 characters and trims", () => {
    expect(categorySchema.parse({ name: "  Clases UNI " }).name).toBe(
      "Clases UNI",
    );
    expect(categorySchema.safeParse({ name: "a".repeat(40) }).success).toBe(
      true,
    );
  });

  it("rejects empty, blank and 41 characters", () => {
    for (const name of ["", "  ", "a".repeat(41)]) {
      const result = categorySchema.safeParse({ name });

      expect(result.success, name).toBe(false);
      if (!result.success) {
        expect(fieldErrorsFromZod(result.error).name).toBe(
          "Escribe un nombre de 1 a 40 caracteres.",
        );
      }
    }
  });
});

describe("parseEventInput", () => {
  const timed: EventFormInput = {
    title: "Matemáticas",
    calendarId: UUID_A,
    allDay: false,
    startDate: "2026-11-02",
    startTime: "08:00",
    endDate: "2026-11-02",
    endTime: "09:30",
    description: "",
    location: "",
    color: "",
    categoryId: "",
  };

  function errorsOf(input: EventFormInput) {
    const result = parseEventInput(input, MADRID);
    if (result.ok) throw new Error("expected validation errors");
    return result.fieldErrors;
  }

  it("converts local date and time to UTC instants in the profile zone (RF-15)", () => {
    const result = parseEventInput(timed, MADRID);

    expect(result).toEqual({
      ok: true,
      data: {
        title: "Matemáticas",
        calendarId: UUID_A,
        allDay: false,
        startsAt: "2026-11-02T07:00:00.000Z",
        endsAt: "2026-11-02T08:30:00.000Z",
        description: null,
        location: null,
        color: null,
        categoryId: null,
      },
    });
  });

  it("keeps optional fields, normalizing color and empty values (RF-16)", () => {
    const result = parseEventInput(
      {
        ...timed,
        description: " Aula 3 ",
        location: " Facultad ",
        color: "#ffc6ff",
        categoryId: UUID_B,
      },
      MADRID,
    );

    expect(result.ok && result.data).toMatchObject({
      description: "Aula 3",
      location: "Facultad",
      color: "#FFC6FF",
      categoryId: UUID_B,
    });
  });

  it("limits the title to 1-100 characters, description to 2000 and location to 200 (RF-19, RF-16)", () => {
    expect(
      parseEventInput({ ...timed, title: "t".repeat(100) }, MADRID).ok,
    ).toBe(true);
    expect(errorsOf({ ...timed, title: "" }).title).toBe(
      "Escribe un título de 1 a 100 caracteres.",
    );
    expect(errorsOf({ ...timed, title: "   " }).title).toBeDefined();
    expect(errorsOf({ ...timed, title: "t".repeat(101) }).title).toBeDefined();
    expect(
      errorsOf({ ...timed, description: "d".repeat(2001) }).description,
    ).toBe("La descripción no puede superar los 2000 caracteres.");
    expect(errorsOf({ ...timed, location: "l".repeat(201) }).location).toBe(
      "El lugar no puede superar los 200 caracteres.",
    );
  });

  it("rejects an end before the start, next to the end field (RF-18)", () => {
    expect(errorsOf({ ...timed, endTime: "07:59" })).toEqual({
      endTime: "El fin no puede ser anterior al inicio.",
    });
    expect(errorsOf({ ...timed, endDate: "2026-11-01" })).toEqual({
      endDate: "El fin no puede ser anterior al inicio.",
    });
  });

  it("allows an end equal to the start (zero duration)", () => {
    expect(parseEventInput({ ...timed, endTime: "08:00" }, MADRID).ok).toBe(
      true,
    );
  });

  it("allows events spanning several days and crossing midnight (RF-21)", () => {
    const result = parseEventInput(
      { ...timed, startTime: "23:00", endDate: "2026-11-03", endTime: "02:00" },
      MADRID,
    );

    expect(result.ok && [result.data.startsAt, result.data.endsAt]).toEqual([
      "2026-11-02T22:00:00.000Z",
      "2026-11-03T01:00:00.000Z",
    ]);
  });

  it("keeps the typed hour across a clock change (casos límite)", () => {
    const result = parseEventInput(
      {
        ...timed,
        startDate: "2026-10-25",
        endDate: "2026-10-25",
        startTime: "12:00",
        endTime: "13:00",
      },
      MADRID,
    );

    expect(result.ok && result.data.startsAt).toBe("2026-10-25T11:00:00.000Z");
  });

  it("validates dates and times", () => {
    expect(errorsOf({ ...timed, startDate: "2026-02-30" }).startDate).toBe(
      "Introduce una fecha de inicio válida.",
    );
    expect(errorsOf({ ...timed, endDate: "" }).endDate).toBe(
      "Introduce una fecha de fin válida.",
    );
    expect(errorsOf({ ...timed, startTime: "25:00" }).startTime).toBe(
      "Introduce una hora de inicio válida.",
    );
    expect(errorsOf({ ...timed, endTime: "" }).endTime).toBe(
      "Introduce una hora de fin válida.",
    );
  });

  it("stores all-day events as UTC dates with an exclusive end, ignoring times (RF-20)", () => {
    const result = parseEventInput(
      {
        ...timed,
        allDay: true,
        startDate: "2026-12-24",
        endDate: "2026-12-26",
        startTime: "garbage",
        endTime: "",
      },
      MADRID,
    );

    expect(result.ok && result.data).toMatchObject({
      allDay: true,
      startsAt: "2026-12-24T00:00:00.000Z",
      endsAt: "2026-12-27T00:00:00.000Z",
    });
  });

  it("rejects an all-day end before the start", () => {
    expect(
      errorsOf({
        ...timed,
        allDay: true,
        startDate: "2026-12-24",
        endDate: "2026-12-23",
      }),
    ).toEqual({ endDate: "El fin no puede ser anterior al inicio." });
  });

  it("requires a calendar and rejects colors outside the palette or bad category ids", () => {
    expect(errorsOf({ ...timed, calendarId: "" }).calendarId).toBe(
      "Elige un calendario.",
    );
    expect(errorsOf({ ...timed, color: "#123456" }).color).toBe(
      "Elige uno de los colores de la paleta.",
    );
    expect(errorsOf({ ...timed, categoryId: "no-es-uuid" }).categoryId).toBe(
      "Elige una categoría válida.",
    );
  });
});

describe("parseMergeInput (RF-49, RF-50)", () => {
  const base = {
    sourceIds: [UUID_A, UUID_B],
    targetId: "",
    newName: "",
    newColor: "",
  };

  it("merges into one of the chosen calendars", () => {
    expect(parseMergeInput({ ...base, targetId: UUID_B })).toEqual({
      ok: true,
      data: {
        sourceIds: [UUID_A, UUID_B],
        targetId: UUID_B,
        name: null,
        color: null,
      },
    });
  });

  it("merges into a new calendar with name and color", () => {
    expect(
      parseMergeInput({
        ...base,
        newName: " Universidad ",
        newColor: "#a0c4ff",
      }),
    ).toEqual({
      ok: true,
      data: {
        sourceIds: [UUID_A, UUID_B],
        targetId: null,
        name: "Universidad",
        color: "#A0C4FF",
      },
    });
  });

  it("needs at least two distinct calendars", () => {
    for (const sourceIds of [[], [UUID_A], [UUID_A, UUID_A]]) {
      const result = parseMergeInput({ ...base, sourceIds, targetId: UUID_A });

      expect(result.ok).toBe(false);
      expect(!result.ok && result.fieldErrors.sourceIds).toBe(
        "Elige al menos dos calendarios.",
      );
    }
  });

  it("rejects a target that is not among the chosen calendars", () => {
    const result = parseMergeInput({ ...base, targetId: UUID_C });

    expect(!result.ok && result.fieldErrors.targetId).toBe(
      "El resultado debe ser uno de los calendarios elegidos.",
    );
  });

  it("requires a valid name and color for a new calendar", () => {
    const noName = parseMergeInput({ ...base, newColor: "#A0C4FF" });
    const badColor = parseMergeInput({
      ...base,
      newName: "Uni",
      newColor: "#123456",
    });

    expect(!noName.ok && noName.fieldErrors.newName).toBe(
      "Escribe un nombre de 1 a 50 caracteres.",
    );
    expect(!badColor.ok && badColor.fieldErrors.newColor).toBe(
      "Elige uno de los colores de la paleta.",
    );
  });
});
