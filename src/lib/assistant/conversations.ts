import { z } from "zod";

// Spec 052 RF-9 to RF-11 (plan D3): what a saved conversation keeps. Pure:
// shared by the chat and its Server Actions. Images are never kept (only how
// many there were) and a card waiting for "Confirmar" comes back expired.

/** RF-10: at most this many per user (the database keeps the newest). */
export const MAX_CONVERSATIONS = 50;
/** The last messages kept, so a long chat fits in its 200 KB. */
export const MAX_SAVED_MESSAGES = 60;
export const TITLE_LENGTH = 100;

export const CONVERSATION_TEXTS = {
  failed: "No se ha podido guardar. Inténtalo de nuevo.",
  gone: "Esta conversación ya no está guardada.",
} as const;

const text = (max: number) => z.string().max(max);
const instant = z.string().max(40);

const eventShape = z
  .object({
    id: text(80),
    title: text(300),
    startsAt: instant,
    endsAt: instant,
    allDay: z.boolean(),
    calendarName: text(200),
    color: text(40),
  })
  .loose();

// Each card keeps whatever it had; only what the chat draws is checked.
const actionShape = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("note"),
      key: text(80),
      note: z
        .object({
          id: text(80),
          title: text(300),
          items: z.array(text(500)).max(200),
        })
        .loose(),
    })
    .loose(),
  z
    .object({ kind: z.literal("created"), key: text(80), event: eventShape })
    .loose(),
  z
    .object({
      kind: z.literal("change"),
      key: text(80),
      before: eventShape,
      after: eventShape,
    })
    .loose(),
  z
    .object({ kind: z.literal("delete"), key: text(80), event: eventShape })
    .loose(),
  z
    .object({
      kind: z.literal("series"),
      key: text(80),
      event: eventShape,
      summary: text(300),
      dates: z.array(instant).max(3),
    })
    .loose(),
]);

const statusShape = z.enum([
  "done",
  "pending",
  "applied",
  "cancelled",
  "superseded",
  "undone",
  "failed",
  "expired",
]);

export const savedMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: text(6000),
  at: z.number().optional(),
  imageCount: z.int().min(1).max(10).optional(),
  events: z.array(eventShape).max(100).optional(),
  actions: z
    .array(
      z
        .object({
          action: actionShape,
          status: statusShape,
          error: text(500).optional(),
        })
        .loose(),
    )
    .max(10)
    .optional(),
});

export type SavedMessage = z.infer<typeof savedMessageSchema>;

export const savedMessagesSchema = z
  .array(savedMessageSchema)
  .min(1)
  .max(MAX_SAVED_MESSAGES);

/** What the chat keeps of a message, before it is saved. */
export interface ChatMessageLike {
  role: "user" | "assistant";
  content: string;
  at?: number;
  images?: string[];
  imageCount?: number;
  events?: unknown[];
  actions?: { action: unknown; status: string; error?: string }[];
  /** A proposal (spec 022) is never saved: it lives with its images. */
  proposal?: unknown;
}

/** RF-11: without images (only how many), proposals nor undo tokens. */
export function toSaved(messages: readonly ChatMessageLike[]): unknown[] {
  return messages.slice(-MAX_SAVED_MESSAGES).map((message) => {
    const count = message.images?.length ?? message.imageCount ?? 0;
    return {
      role: message.role,
      content: message.content,
      ...(message.at ? { at: message.at } : {}),
      ...(count ? { imageCount: count } : {}),
      ...(message.events?.length ? { events: message.events } : {}),
      ...(message.actions?.length
        ? {
            actions: message.actions.map(({ action, status, error }) => ({
              action,
              status,
              ...(error ? { error } : {}),
            })),
          }
        : {}),
    };
  });
}

/** RF-11: a card that was waiting can no longer be confirmed. */
export function fromSaved(messages: readonly SavedMessage[]): SavedMessage[] {
  return messages.map((message) =>
    message.actions
      ? {
          ...message,
          actions: message.actions.map((card) =>
            card.status === "pending" || card.status === "failed"
              ? { ...card, status: "expired" as const, error: undefined }
              : card,
          ),
        }
      : message,
  );
}

/** "1 imagen adjunta", "2 imágenes adjuntas" (RF-11). */
export const imagesText = (count: number) =>
  count === 1 ? "1 imagen adjunta" : `${count} imágenes adjuntas`;

/** RF-10: the first question, or what it attached when it had no text. */
export function conversationTitle(
  messages: readonly ChatMessageLike[],
): string {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "Conversación";
  const words = first.content.replace(/\s+/g, " ").trim();
  if (words) {
    return [...words].length > TITLE_LENGTH
      ? `${[...words].slice(0, TITLE_LENGTH - 1).join("")}…`
      : words;
  }
  const count = first.images?.length ?? first.imageCount ?? 0;
  return count ? imagesText(count) : "Conversación";
}
