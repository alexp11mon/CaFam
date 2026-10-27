import { z } from "zod";
import { MAX_CALENDARS_PER_ACCOUNT } from "./limits";

// Validation of the connection actions (spec 007; RF-9, RF-11, RF-14, RF-27).

export const connectionIdSchema = z.uuid();

/** One checked calendar, as the picker sends it. The color comes from Google. */
const pickedCalendar = z.object({
  id: z.string().min(1).max(1024),
  name: z.string().max(200),
  color: z.string().nullable(),
});

export const selectionSchema = z.object({
  connectionId: connectionIdSchema,
  calendars: z
    .array(pickedCalendar)
    .max(
      MAX_CALENDARS_PER_ACCOUNT,
      `Puedes traer como máximo ${MAX_CALENDARS_PER_ACCOUNT} calendarios por cuenta.`,
    ),
  decision: z.enum(["keep", "delete"]).optional(),
});
