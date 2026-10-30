import type { z } from "zod";
import { MAX_RRULE_LENGTH } from "./limits";
import { recurrenceRuleSchema, WEEKDAYS } from "./schemas";

// A recurrence rule and its RRULE text (RFC 5545, without DTSTART). Pure: no
// ical.js, so the form can use it in the browser (plan "recurrence-rule").

export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type Weekday = (typeof WEEKDAYS)[number];
export type RecurrenceEnd = RecurrenceRule["end"];

const FREQS = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
} as const;

/**
 * The BY* parts are always written, so the rule never depends on the start
 * (plan D5). A timed UNTIL is the end of that day in wall-clock time.
 */
export function toRRule(rule: RecurrenceRule, allDay: boolean): string {
  const parts = [`FREQ=${FREQS[rule.freq]}`, `INTERVAL=${rule.interval}`];
  if (rule.freq === "weekly") parts.push(`BYDAY=${rule.byDay.join(",")}`);
  if (rule.freq === "monthly") {
    parts.push(
      "day" in rule.monthly
        ? `BYMONTHDAY=${rule.monthly.day}`
        : `BYDAY=${rule.monthly.pos}${rule.monthly.weekday}`,
    );
  }
  if (rule.freq === "yearly") {
    parts.push(`BYMONTH=${rule.yearly.month}`, `BYMONTHDAY=${rule.yearly.day}`);
  }
  if (rule.end.kind === "count") parts.push(`COUNT=${rule.end.count}`);
  if (rule.end.kind === "until") {
    const date = rule.end.date.replaceAll("-", "");
    parts.push(`UNTIL=${allDay ? date : `${date}T235959`}`);
  }
  return parts.join(";");
}

const ALLOWED = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYMONTHDAY",
  "BYMONTH",
  "COUNT",
  "UNTIL",
]);

/** Only the rules CaFam can configure; anything else is null (plan R3). */
export function fromRRule(text: string): RecurrenceRule | null {
  if (!text || text.length > MAX_RRULE_LENGTH) return null;
  const parts = new Map<string, string>();
  for (const part of text.split(";")) {
    const [key, value, extra] = part.split("=");
    if (!key || !value || extra !== undefined || !ALLOWED.has(key)) return null;
    if (parts.has(key)) return null;
    parts.set(key, value);
  }
  if (parts.has("COUNT") && parts.has("UNTIL")) return null;

  const freq = Object.entries(FREQS).find(([, v]) => v === parts.get("FREQ"));
  if (!freq) return null;

  const end = readEnd(parts);
  if (!end) return null;
  const candidate: Record<string, unknown> = {
    freq: freq[0],
    interval: parts.has("INTERVAL") ? Number(parts.get("INTERVAL")) : 1,
    end,
  };

  const byDay = parts.get("BYDAY");
  const byMonthDay = parts.get("BYMONTHDAY");
  const byMonth = parts.get("BYMONTH");
  switch (freq[0]) {
    case "daily":
      if (byDay || byMonthDay || byMonth) return null;
      break;
    case "weekly":
      if (!byDay || byMonthDay || byMonth) return null;
      candidate.byDay = byDay.split(",");
      break;
    case "monthly": {
      if (byMonth || Boolean(byDay) === Boolean(byMonthDay)) return null;
      if (byMonthDay) {
        candidate.monthly = { day: Number(byMonthDay) };
        break;
      }
      const match = /^(-1|[1-4])([A-Z]{2})$/.exec(byDay!);
      if (!match) return null;
      candidate.monthly = { pos: Number(match[1]), weekday: match[2] };
      break;
    }
    case "yearly":
      if (byDay || !byMonth || !byMonthDay) return null;
      candidate.yearly = { month: Number(byMonth), day: Number(byMonthDay) };
      break;
  }
  const parsed = recurrenceRuleSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function readEnd(parts: Map<string, string>): RecurrenceEnd | null {
  const count = parts.get("COUNT");
  if (count) return { kind: "count", count: Number(count) };
  const until = parts.get("UNTIL");
  if (!until) return { kind: "never" };
  const match = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(until);
  return match
    ? { kind: "until", date: `${match[1]}-${match[2]}-${match[3]}` }
    : null;
}
