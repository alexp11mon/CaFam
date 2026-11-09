import { z } from "zod";
import { QUESTION_MESSAGES } from "./error-messages";
import { MAX_ATTACHMENTS } from "./attachments";
import {
  ANSWER_MAX,
  MAX_PROPOSAL,
  TITLE_MAX,
  MAX_COMMENT_EVENTS,
  MAX_MESSAGES,
  QUESTION_MAX,
} from "./limits";

// Validation of the chat request and of the tool arguments (spec 015 plan
// "Contratos e interfaces").

/**
 * Spec 022 (plan D7): base64 of a 1.2 MB JPEG plus the prefix. The browser
 * already keeps each image under 1.2 MB; this is the trust boundary.
 */
export const IMAGE_DATA_MAX = 1_600_100;
const imageData = z
  .string()
  .max(IMAGE_DATA_MAX)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);

const userMessage = z
  .object({
    role: z.literal("user"),
    // RF-12: a message with images may have no text.
    content: z
      .string()
      .trim()
      .refine((text) => [...text].length <= QUESTION_MAX, {
        message: QUESTION_MESSAGES.tooLong,
      }),
    images: z.array(imageData).min(1).max(MAX_ATTACHMENTS).optional(),
  })
  .refine((m) => m.content.length > 0 || (m.images?.length ?? 0) > 0, {
    message: QUESTION_MESSAGES.empty,
  });

const message = z.discriminatedUnion("role", [
  userMessage,
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(ANSWER_MAX),
  }),
]);

export type ChatMessage = z.infer<typeof message>;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

/** Spec 022, plan "Modelo de datos": one row of a proposal. */
export const proposalRowSchema = z.object({
  key: z.string().min(1).max(40),
  title: z.string().trim().max(TITLE_MAX),
  startDate: dateKey,
  start: time.nullable(),
  endDate: dateKey,
  end: time.nullable(),
  allDay: z.boolean(),
  calendarId: z.uuid(),
  selected: z.boolean(),
  duplicate: z.boolean(),
});

export type ProposalRow = z.infer<typeof proposalRowSchema>;

export const proposalSchema = z.array(proposalRowSchema).max(MAX_PROPOSAL);

/** RF-3, RF-5, D4: the whole thread, ending with the user's question. */
export const assistantRequestSchema = z.object({
  messages: z
    .array(message)
    .min(1)
    .max(MAX_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: QUESTION_MESSAGES.empty,
    })
    // Spec 022, D2: images travel only with the message that attaches them.
    .refine(
      (messages) =>
        messages
          .slice(0, -1)
          .every((m) => m.role !== "user" || m.images === undefined),
      { message: QUESTION_MESSAGES.empty },
    ),
  /** Spec 022, RF-33: the proposal as the user left it. */
  proposal: proposalSchema.optional(),
});

export const listEventsArgsSchema = z.object({ from: dateKey, to: dateKey });

export const searchArgsSchema = z.object({
  query: z.string().trim().min(2).max(100),
});

/** D15: only references handed out in this question, never ids (RF-35). */
export const commentsArgsSchema = z.object({
  refs: z
    .array(z.string().regex(/^e\d+$/))
    .min(1)
    .max(MAX_COMMENT_EVENTS),
});

export const freeTimeArgsSchema = z.object({
  people: z.array(z.string().trim().min(1).max(60)).max(5),
  from: dateKey,
  to: dateKey,
  ranges: z
    .array(z.object({ start: time, end: time }))
    .max(4)
    .optional(),
});
