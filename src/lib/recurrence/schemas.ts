import { z } from "zod";
import { MAX_COUNT, MAX_INTERVAL } from "./limits";

// Shape of a recurrence rule (RF-3, RF-4). Pure: also used in the browser.

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export const weekdaySchema = z.enum(WEEKDAYS);

/** Days of each month in a leap year. */
const LONGEST_MONTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const interval = z.int().min(1).max(MAX_INTERVAL);

const endSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("never") }),
  // The last day, included (RF-4).
  z.object({
    kind: z.literal("until"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({ kind: z.literal("count"), count: z.int().min(1).max(MAX_COUNT) }),
]);

export const recurrenceRuleSchema = z.discriminatedUnion("freq", [
  z.object({ freq: z.literal("daily"), interval, end: endSchema }),
  z.object({
    freq: z.literal("weekly"),
    interval,
    byDay: z.array(weekdaySchema).min(1).max(7),
    end: endSchema,
  }),
  z.object({
    freq: z.literal("monthly"),
    interval,
    monthly: z.union([
      z.object({ day: z.int().min(1).max(31) }),
      z.object({
        pos: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(-1),
        ]),
        weekday: weekdaySchema,
      }),
    ]),
    end: endSchema,
  }),
  z.object({
    freq: z.literal("yearly"),
    interval,
    // A day the month never has would leave the iterator looking forever.
    yearly: z
      .object({ month: z.int().min(1).max(12), day: z.int().min(1).max(31) })
      .refine(({ month, day }) => day <= LONGEST_MONTHS[month - 1]!),
    end: endSchema,
  }),
]);
