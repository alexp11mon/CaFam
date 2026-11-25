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

// Spec 036: what the model may ask to write (plan "Modelo de datos", RF-41).

/** At most 3 events created or changes proposed per message (RF-41). */
export const MAX_WRITES = 3;

// The model sometimes writes "9:00": padded so write-times reads it.
const looseTime = z
  .string()
  .regex(/^\d{1,2}:\d{2}$/)
  .transform((value) => value.padStart(5, "0"));
const maybe = <T extends z.ZodType>(schema: T) => schema.nullish();
const shortText = (max: number) => z.string().trim().max(max);

const timeFields = {
  date: maybe(dateKey),
  start: maybe(looseTime),
  end: maybe(looseTime),
  endDate: maybe(dateKey),
  allDay: maybe(z.boolean()),
  durationMinutes: maybe(
    z
      .number()
      .int()
      .min(5)
      .max(24 * 60),
  ),
  /** Starts when this event ends: "cuando acabe PIAE" (RF-9). */
  after: maybe(shortText(TITLE_MAX).min(1)),
  /** Ends when this event starts: "justo antes de PIAE" (RF-10, RF-11). */
  before: maybe(shortText(TITLE_MAX).min(1)),
  /** The day of `after` or `before`, when the user says it (RF-13). */
  anchorDate: maybe(dateKey),
  location: maybe(shortText(200)),
  description: maybe(shortText(2000)),
  calendar: maybe(shortText(100)),
};

export const createEventsArgsSchema = z.object({
  events: z
    .array(z.object({ title: shortText(TITLE_MAX).min(1), ...timeFields }))
    .min(1)
    .max(MAX_WRITES),
});

export type CreateEventArgs = z.infer<
  typeof createEventsArgsSchema
>["events"][number];

export const changeScopeSchema = z.enum(["this", "following", "all"]);

export const proposeChangesArgsSchema = z.object({
  changes: z
    .array(
      z.object({
        /** The title of the event to change (RF-24). */
        event: shortText(TITLE_MAX).min(1),
        /** Its day, when the user says it (RF-13). */
        eventDate: maybe(dateKey),
        scope: maybe(changeScopeSchema),
        title: maybe(shortText(TITLE_MAX).min(1)),
        ...timeFields,
      }),
    )
    .min(1)
    .max(MAX_WRITES),
});

export type ChangeArgs = z.infer<
  typeof proposeChangesArgsSchema
>["changes"][number];

const instant = z.iso.datetime({ offset: true });
// A row or an occurrence "<uuid>_<YYYYMMDDTHHMMSSZ>" (spec 013).
const eventId = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(_\d{8}T\d{6}Z)?$/i,
  );

export const changeFieldsSchema = z
  .object({
    title: shortText(TITLE_MAX).min(1),
    description: z.string().max(2000).nullable(),
    location: z.string().max(200).nullable(),
    calendarId: z.uuid(),
    startsAt: instant,
    endsAt: instant,
    allDay: z.boolean(),
  })
  .refine((fields) => Date.parse(fields.endsAt) > Date.parse(fields.startsAt));

/** Spec 036 RF-24a: what "Confirmar" sends back; checked again on the server. */
export const pendingChangeSchema = z.object({
  id: eventId,
  scope: changeScopeSchema.nullable(),
  updatedAt: z.string().max(64),
  fields: changeFieldsSchema,
});

export const assistantUndoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("unnote"),
    id: z.uuid(),
    updatedAt: z.string().max(64),
    itemIds: z.array(z.uuid()).max(50).optional(),
  }),
  z.object({
    kind: z.literal("uncreate"),
    id: z.uuid(),
    updatedAt: z.string().max(64),
  }),
  z.object({
    kind: z.literal("unchange"),
    id: eventId,
    updatedAt: z.string().max(64),
    before: changeFieldsSchema,
    series: z.boolean(),
  }),
]);
