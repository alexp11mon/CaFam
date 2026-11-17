// What the browser sends when it replays a change made offline (spec 034
// RNF-5): the server action validates it here, at the trust boundary. The
// database checks permissions and limits again.
import { z } from "zod";
import { isPaletteColor } from "@/lib/calendar/palette";
import { itemTextSchema, noteIdSchema as uuid } from "@/lib/notes/schemas";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from "@/lib/notes/limits";
import { parseDateKey } from "@/lib/calendar/time-zone";
import { parseEventId } from "@/lib/recurrence/occurrence-id";

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
const itemFields = z.object({ text: itemTextSchema, done: z.boolean() });
const position = z.number().int().min(0).max(100_000);

export const offlineChangeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("event.create"),
    id: uuid,
    data: eventDataSchema,
  }),
  z.object({
    type: z.literal("event.update"),
    id: eventId,
    base: eventDataSchema,
    data: eventDataSchema,
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
]);

export type ParsedChange = z.infer<typeof offlineChangeSchema>;
