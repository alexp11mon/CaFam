// Apart from view-options.ts, which the calendar loads in the browser: zod
// stays out of its first JS (spec 024 RF-14).
import { z } from "zod";
import { DURATIONS, type Duration } from "./view-options";

export const durationSchema = z
  .number()
  .refine((value): value is Duration => DURATIONS.includes(value as Duration), {
    message: "Elige una duración de la lista.",
  });
