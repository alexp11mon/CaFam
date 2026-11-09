import { describe, expect, it } from "vitest";
import {
  IMAGE_DATA_MAX,
  assistantRequestSchema,
  proposalRowSchema,
} from "@/lib/assistant/schemas";

// Spec 022, T3: images and the current proposal in the request (RF-4, RF-12,
// RF-33, plan "Contratos").
const IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
const ROW = {
  key: "r1",
  title: "Turno",
  startDate: "2026-11-16",
  start: "08:00",
  endDate: "2026-11-16",
  end: "15:00",
  allDay: false,
  calendarId: "6f1c0a5e-8f0e-4c1e-9a43-2b7d7a1f0c11",
  selected: true,
  duplicate: false,
};

const parse = (body: object) => assistantRequestSchema.safeParse(body);

describe("images in the request", () => {
  it("accepts up to three JPEG data URLs in the last message (RF-4)", () => {
    const result = parse({
      messages: [
        { role: "user", content: "Mi horario", images: [IMG, IMG, IMG] },
      ],
    });
    expect(result.success).toBe(true);
    expect(
      parse({
        messages: [
          { role: "user", content: "x", images: [IMG, IMG, IMG, IMG] },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts a message with images and no text (RF-12)", () => {
    expect(
      parse({ messages: [{ role: "user", content: "  ", images: [IMG] }] })
        .success,
    ).toBe(true);
    expect(
      parse({ messages: [{ role: "user", content: "  ", images: [] }] })
        .success,
    ).toBe(false);
  });

  it("rejects anything that is not a JPEG data URL or is too big", () => {
    for (const image of [
      "data:image/png;base64,iVBORw0KGgo=",
      "https://example.com/a.jpg",
      `data:image/jpeg;base64,${"A".repeat(IMAGE_DATA_MAX)}`,
    ]) {
      expect(
        parse({ messages: [{ role: "user", content: "x", images: [image] }] })
          .success,
      ).toBe(false);
    }
  });

  it("only allows images in the last message (plan D2)", () => {
    expect(
      parse({
        messages: [
          { role: "user", content: "Mi horario", images: [IMG] },
          { role: "assistant", content: "¿Qué semana?" },
          { role: "user", content: "La que viene" },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("current proposal (RF-33)", () => {
  it("accepts the rows the user edited, up to 50", () => {
    expect(
      parse({
        messages: [{ role: "user", content: "El martes entro a las 9" }],
        proposal: [ROW],
      }).success,
    ).toBe(true);
    expect(
      parse({
        messages: [{ role: "user", content: "x" }],
        proposal: Array.from({ length: 51 }, (_, i) => ({
          ...ROW,
          key: `r${i}`,
        })),
      }).success,
    ).toBe(false);
  });

  it("validates each row's dates, hours and calendar", () => {
    expect(proposalRowSchema.safeParse(ROW).success).toBe(true);
    expect(
      proposalRowSchema.safeParse({
        ...ROW,
        allDay: true,
        start: null,
        end: null,
      }).success,
    ).toBe(true);
    for (const bad of [
      { startDate: "16/11/2026" },
      { start: "8:00" },
      { calendarId: "trabajo" },
      { title: "a".repeat(101) },
    ]) {
      expect(proposalRowSchema.safeParse({ ...ROW, ...bad }).success).toBe(
        false,
      );
    }
  });
});
