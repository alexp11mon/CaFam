import { formatDayHeading } from "@/lib/calendar/format";
import type { RepeatPreset } from "@/lib/recurrence/presets";
import type { ResolvedEvent } from "./resolve";
import type { Span, SpanKind } from "./tokenize";

// What the phrase was understood as, said back in the form (spec 041 RF-11).
// Pure.

const REPEAT_LABELS: Record<RepeatPreset, string> = {
  none: "No se repite",
  daily: "Cada día",
  weekly: "Cada semana",
  "monthly-day": "Cada mes",
  "monthly-pos": "Cada mes",
  "monthly-last": "Cada mes",
  yearly: "Cada año",
  weekdays: "De lunes a viernes",
};

const capitalize = (text: string) =>
  text ? text[0]!.toLocaleUpperCase("es") + text.slice(1) : text;

/** "Jueves, 20 de noviembre · 10:30–11:30 · Calle Mayor · @Familia". */
export function previewText(event: ResolvedEvent): string {
  const day = capitalize(formatDayHeading(event.startDate));
  const parts = [event.title || "Sin título"];
  if (event.allDay) {
    parts.push(
      event.endDate === event.startDate
        ? `${day} · Todo el día`
        : `${day} – ${formatDayHeading(event.endDate)}`,
    );
  } else {
    const nextDay = event.endDate !== event.startDate ? " (día siguiente)" : "";
    parts.push(`${day} · ${event.startTime}–${event.endTime}${nextDay}`);
  }
  if (event.location) parts.push(event.location);
  if (event.calendarName) parts.push(`@${event.calendarName}`);
  if (event.repeat) parts.push(REPEAT_LABELS[event.repeat]);
  return parts.join(" · ");
}

export interface Segment {
  text: string;
  kind: SpanKind | null;
}

/** The phrase cut into what was recognized and what was not (RNF-3). */
export function highlight(text: string, spans: readonly Span[]): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start < at) continue;
    if (span.start > at) {
      segments.push({ text: text.slice(at, span.start), kind: null });
    }
    segments.push({ text: text.slice(span.start, span.end), kind: span.kind });
    at = span.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), kind: null });
  return segments;
}
