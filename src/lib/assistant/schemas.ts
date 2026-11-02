import { z } from "zod";
import { QUESTION_MESSAGES } from "./error-messages";
import {
  ANSWER_MAX,
  MAX_COMMENT_EVENTS,
  MAX_MESSAGES,
  QUESTION_MAX,
} from "./limits";

// Validation of the chat request and of the tool arguments (spec 015 plan
// "Contratos e interfaces").

const question = z
  .string()
  .trim()
  .min(1, QUESTION_MESSAGES.empty)
  .refine((text) => [...text].length <= QUESTION_MAX, {
    message: QUESTION_MESSAGES.tooLong,
  });

const message = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: question }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().max(ANSWER_MAX),
  }),
]);

export type ChatMessage = z.infer<typeof message>;

/** RF-3, RF-5, D4: the whole thread, ending with the user's question. */
export const assistantRequestSchema = z.object({
  messages: z
    .array(message)
    .min(1)
    .max(MAX_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: QUESTION_MESSAGES.empty,
    }),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

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
