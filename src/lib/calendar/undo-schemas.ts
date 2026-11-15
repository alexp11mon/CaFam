// Validation of a quick change and of its undo token on the server, apart
// from undo.ts, which the calendar loads in the browser (spec 024 RF-14).
import { z } from "zod";
import { isPaletteColor } from "./palette";

const DAY_MS = 86_400_000;
const isMidnight = (value: string) => Date.parse(value) % DAY_MS === 0;

export const changeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("times"),
      startsAt: z.iso.datetime({ offset: true }),
      endsAt: z.iso.datetime({ offset: true }),
      allDay: z.boolean(),
    })
    .refine((times) => Date.parse(times.endsAt) >= Date.parse(times.startsAt))
    // All-day events run from 00:00 UTC to 00:00 UTC (spec 002 plan D6).
    .refine(
      (times) =>
        !times.allDay ||
        (isMidnight(times.startsAt) && isMidnight(times.endsAt)),
    ),
  z.object({
    kind: z.literal("color"),
    color: z
      .string()
      .refine(isPaletteColor)
      .transform((value) => value.toUpperCase())
      .nullable(),
  }),
]);

export const undoTokenSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("change"),
    id: z.string(),
    before: changeSchema,
    updatedAt: z.string(),
    series: z.boolean(),
  }),
  z.object({ kind: z.literal("restore"), trashId: z.uuid() }),
  z.object({ kind: z.literal("unpaste"), id: z.uuid() }),
]);
