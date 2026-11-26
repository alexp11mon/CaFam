import { describe, expect, it } from "vitest";
import { translator } from "@/i18n/translator";
import { dateContext } from "@/lib/assistant/dates";
import { systemPrompt } from "@/lib/assistant/prompt";
import { statusFor } from "@/lib/assistant/stream";
import { undoLabel } from "@/lib/calendar/undo-stack";
import { relativeTime } from "@/lib/comments/relative-time";
import { dueLabel } from "@/lib/notes/due";
import { fromRRule } from "@/lib/recurrence/rule";
import { summarizeRule } from "@/lib/recurrence/summary";

// Spec 053 T4: texts built with values come out in English for "en".
const TZ = "Europe/Madrid";
const en = translator("en");

describe("English texts with values", () => {
  it("asks the assistant to answer in English", () => {
    const context = dateContext(new Date("2026-11-18T09:00:00Z"), TZ);
    expect(systemPrompt(context, TZ, undefined, "en")).toContain("inglés");
    expect(systemPrompt(context, TZ)).not.toContain("inglés");
  });

  it("translates a status and an undo label", () => {
    expect(statusFor("search_events", '{"query":"dentista"}', en)).toContain(
      "dentista",
    );
    expect(statusFor("search_events", '{"query":"dentista"}', en)).not.toBe(
      statusFor("search_events", '{"query":"dentista"}'),
    );
    expect(undoLabel("Evento movido", "Dentista", en)).toBe("move “Dentista”");
    expect(undoLabel("Evento movido", "Dentista")).toBe("mover «Dentista»");
  });

  it("summarizes a rule, a time ago and a due date in English", () => {
    expect(summarizeRule(fromRRule("FREQ=DAILY;INTERVAL=1")!, "en")).toMatch(
      /day/i,
    );
    const now = new Date("2026-11-25T12:00:00Z");
    const ago = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(relativeTime(ago, now, TZ, "en")).not.toBe(
      relativeTime(ago, now, TZ),
    );
    expect(dueLabel("2026-11-26", "18:30", "2026-11-25", "en")).toBe(
      "tomorrow · 18:30",
    );
  });
});
