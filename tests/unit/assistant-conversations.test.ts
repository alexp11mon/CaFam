import { describe, expect, it } from "vitest";
import {
  conversationTitle,
  fromSaved,
  MAX_SAVED_MESSAGES,
  savedMessagesSchema,
  toSaved,
} from "@/lib/assistant/conversations";

// Spec 052 T5: what a saved conversation keeps (RF-9 to RF-11).

const event = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Cena",
  startsAt: "2026-11-20T19:00:00.000Z",
  endsAt: "2026-11-20T21:00:00.000Z",
  allDay: false,
  calendarName: "Uni",
  color: "#A0C4FF",
};

describe("toSaved", () => {
  it("keeps how many images, never the images nor proposals (RF-11)", () => {
    const saved = toSaved([
      {
        role: "user",
        content: "Mira este horario",
        at: 1,
        images: ["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"],
      },
      {
        role: "assistant",
        content: "Te propongo esto.",
        proposal: { rows: [] },
      },
    ]);
    expect(saved).toEqual([
      { role: "user", content: "Mira este horario", at: 1, imageCount: 2 },
      { role: "assistant", content: "Te propongo esto." },
    ]);
    expect(JSON.stringify(saved)).not.toContain("base64");
    expect(savedMessagesSchema.safeParse(saved).success).toBe(true);
  });

  it("keeps the cards without what undoing them needed", () => {
    const saved = toSaved([
      { role: "user", content: "Borra la cena" },
      {
        role: "assistant",
        content: "Revisa.",
        actions: [
          {
            action: { kind: "delete", key: "d1", event },
            status: "applied",
            undo: { kind: "restore", trashId: event.id },
          } as never,
        ],
      },
    ]);
    expect(saved[1]).toEqual({
      role: "assistant",
      content: "Revisa.",
      actions: [
        { action: { kind: "delete", key: "d1", event }, status: "applied" },
      ],
    });
  });

  it("keeps only the last messages", () => {
    const many = Array.from({ length: MAX_SAVED_MESSAGES + 10 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      content: `m${i}`,
    }));
    const saved = toSaved(many) as { content: string }[];
    expect(saved).toHaveLength(MAX_SAVED_MESSAGES);
    expect(saved[0]!.content).toBe("m10");
  });
});

describe("fromSaved", () => {
  it("shows a card that was waiting as expired (RF-11)", () => {
    const [message] = fromSaved([
      {
        role: "assistant",
        content: "Revisa.",
        actions: [
          {
            action: { kind: "delete", key: "d1", event },
            status: "pending",
          },
          {
            action: { kind: "created", key: "c1", event },
            status: "done",
          },
        ],
      },
    ]);
    expect(message!.actions!.map((card) => card.status)).toEqual([
      "expired",
      "done",
    ]);
  });

  it("refuses what the chat could not draw", () => {
    expect(
      savedMessagesSchema.safeParse([
        {
          role: "assistant",
          content: "x",
          actions: [{ action: { kind: "delete", key: "d" }, status: "done" }],
        },
      ]).success,
    ).toBe(false);
    expect(savedMessagesSchema.safeParse([]).success).toBe(false);
  });
});

describe("conversationTitle", () => {
  it("is the first question, cut at 100 characters (RF-10)", () => {
    expect(
      conversationTitle([
        { role: "user", content: "  ¿Qué tengo\nmañana?  " },
        { role: "user", content: "Otra" },
      ]),
    ).toBe("¿Qué tengo mañana?");
    const long = conversationTitle([
      { role: "user", content: "a".repeat(150) },
    ]);
    expect([...long]).toHaveLength(100);
    expect(long.endsWith("…")).toBe(true);
  });

  it("says the images when the question had no text", () => {
    expect(
      conversationTitle([
        { role: "user", content: "", images: ["data:image/jpeg;base64,AA"] },
      ]),
    ).toBe("1 imagen adjunta");
  });
});
