// What the browser sends when it replays a change made offline (spec 034
// RNF-5): the server action validates it here, at the trust boundary. The
// database checks permissions and limits again.
import { z } from "zod";
import { isPaletteColor } from "@/lib/calendar/palette";
import {
  itemDueSchema,
  itemTextSchema,
  noteIdSchema as uuid,
} from "@/lib/notes/schemas";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from "@/lib/notes/limits";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { parseEventId } from "@/lib/recurrence/occurrence-id";
import { CUSTOM_PREFIX, resolveRepeat } from "@/lib/recurrence/presets";
import { MAX_RRULE_LENGTH } from "@/lib/recurrence/limits";
import { commentBodySchema } from "@/lib/comments/schemas";

const eventId = z.string().refine((id) => parseEventId(id) !== null);
const color = z.string().refine(isPaletteColor).nullable();

export const eventDataSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    calendarId: uuid,
    allDay: z.boolean(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    // Undefined for the description of a partial event (plan R6).
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(200).nullable(),
    color,
    categoryId: uuid.nullable(),
  })
  .refine((data) => Date.parse(data.endsAt) >= Date.parse(data.startsAt));

const noteFields = z.object({
  title: z.string().trim().max(NOTE_TITLE_MAX),
  body: z.string().max(NOTE_BODY_MAX),
  color,
  pinned: z.boolean(),
  archived: z.boolean(),
  dueDate: z
    .string()
    .refine((value) => parseDateKey(value) !== null)
    .nullable(),
});
const itemFields = z.object({
  text: itemTextSchema,
  done: z.boolean(),
  // Optional: changes queued before spec 048 do not have them.
  dueDate: itemDueSchema.dueDate.optional(),
  dueTime: itemDueSchema.dueTime.optional(),
});

const PRESETS = [
  "none",
  "daily",
  "weekly",
  "monthly-day",
  "monthly-pos",
  "monthly-last",
  "yearly",
  "weekdays",
];
/** "Repetir" as the form sends it; the server resolves it with the date (spec 035 RF-11). */
const repeat = z
  .string()
  .refine(
    (value) =>
      PRESETS.includes(value) ||
      (value.startsWith(CUSTOM_PREFIX) &&
        resolveRepeat(value, "2026-01-05").ok),
  );
const seriesBase = z.object({
  fields: eventDataSchema,
  recurrence: z.string().min(1).max(MAX_RRULE_LENGTH),
  exdates: z.array(z.iso.datetime({ offset: true })).max(500),
  totals: z.object({
    exceptions: z.number().int().min(0),
    images: z.number().int().min(0),
    comments: z.number().int().min(0),
    latest: z.iso.datetime({ offset: true }).nullable(),
  }),
});
const scope = z.enum(["this", "following", "all"]);
const commentBase = z.object({ body: z.string().max(4000) });
const position = z.number().min(0).max(100_000);

export const offlineChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event.create"),
    id: uuid,
    data: eventDataSchema,
    repeat: repeat.optional(),
  }),
  z.object({
    type: z.literal("event.update"),
    id: eventId,
    base: eventDataSchema,
    data: eventDataSchema,
    repeat: repeat.optional(),
  }),
  z.object({
    type: z.literal("event.delete"),
    id: eventId,
    base: eventDataSchema,
  }),
  z.object({
    type: z.literal("note.create"),
    id: uuid,
    kind: z.enum(["list", "text"]),
    calendarId: uuid.nullable(),
    fields: noteFields.partial(),
  }),
  z.object({
    type: z.literal("note.update"),
    id: uuid,
    base: noteFields,
    fields: noteFields.partial(),
  }),
  z.object({ type: z.literal("note.delete"), id: uuid, base: noteFields }),
  z.object({
    type: z.literal("item.add"),
    noteId: uuid,
    id: uuid,
    text: itemTextSchema,
    position,
    done: z.boolean(),
  }),
  z.object({
    type: z.literal("item.update"),
    noteId: uuid,
    id: uuid,
    base: itemFields,
    change: itemFields.partial(),
  }),
  z.object({
    type: z.literal("item.delete"),
    noteId: uuid,
    id: uuid,
    base: itemFields,
  }),
  z.object({
    type: z.literal("item.move"),
    noteId: uuid,
    positions: z
      .array(z.object({ id: uuid, position }))
      .min(1)
      .max(200),
  }),
  z.object({
    type: z.literal("series.update"),
    id: eventId,
    scope,
    base: seriesBase,
    data: eventDataSchema,
    repeat,
  }),
  z.object({
    type: z.literal("series.delete"),
    id: eventId,
    scope,
    base: seriesBase,
  }),
  z.object({
    type: z.literal("comment.add"),
    eventId,
    clientId: uuid,
    body: commentBodySchema,
  }),
  z.object({
    type: z.literal("comment.update"),
    id: uuid,
    eventId,
    base: commentBase,
    body: commentBodySchema,
  }),
  z.object({
    type: z.literal("comment.delete"),
    id: uuid,
    eventId,
    base: commentBase,
  }),
  // "image.add" never reaches here: its bytes go by /api/offline/image (D5).
  z.object({ type: z.literal("image.delete"), id: uuid, eventId }),
]);

export type ParsedChange = z.infer<typeof offlineChangeSchema>;
