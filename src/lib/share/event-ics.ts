import { writeIcs } from "@/lib/ics/write-ics";
import type { ShareableEvent } from "./text";

/** "cumpleanos-de-jose.ics" from "Cumpleaños de José!". */
export function icsFileName(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "evento"}.ics`;
}

/**
 * The shared event as a one-event .ics with `write-ics` (spec 047 RF-1). An
 * occurrence of a series goes alone, at its own time: who receives it gets
 * that day, not the rule.
 */
export function eventIcs(
  event: ShareableEvent,
  now: Date,
): { filename: string; text: string } {
  const stamp = now.toISOString();
  return {
    filename: icsFileName(event.title),
    text: writeIcs({
      name: event.title,
      now,
      rows: [
        {
          id: event.id,
          title: event.title,
          description: event.description,
          location: event.location,
          starts_at: event.startsAt,
          ends_at: event.endsAt,
          all_day: event.allDay,
          recurrence: null,
          recurrence_tz: null,
          exdates: null,
          series_id: null,
          original_start: null,
          created_at: stamp,
          updated_at: stamp,
        },
      ],
    }),
  };
}
