"use client";

import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { MatchableCalendar } from "@/lib/assistant/calendar-match";
import { todayKey } from "@/lib/calendar/format";
import { parseEventText } from "@/lib/nl/parse";
import { highlight, previewText, type Segment } from "@/lib/nl/preview";
import { resolveParsed, type ResolvedEvent } from "@/lib/nl/resolve";

export type { ResolvedEvent };

/**
 * Sets an uncontrolled field as typing would, so its own onChange runs: React
 * only sees the native setter followed by the event (spec 041 RF-12).
 */
export function fillField(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement && field.type === "checkbox") {
    if (field.checked !== (value === "on")) field.click();
    return;
  }
  if (
    !(field instanceof HTMLInputElement) &&
    !(field instanceof HTMLSelectElement)
  ) {
    return;
  }
  const proto = Object.getPrototypeOf(field) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(field, value);
  field.dispatchEvent(
    new Event(field instanceof HTMLSelectElement ? "change" : "input", {
      bubbles: true,
    }),
  );
}

interface Understood {
  segments: Segment[];
  event: ResolvedEvent;
}

/**
 * "Escribe el evento": a phrase read as it is typed, with what was understood
 * below, and "Aplicar" (or Intro) to fill the form (spec 041 RF-11, RF-12,
 * plan D2). Pure reading: it works offline too (RF-14).
 */
export function NlField({
  timeZone,
  defaultMinutes,
  calendars,
  fallback,
  onApply,
  autoFocus = false,
  defaultText = "",
}: {
  /** Text shared from another app, read but not applied (spec 047 RF-8). */
  defaultText?: string;
  timeZone: string;
  defaultMinutes: number;
  /** Where the user can write; "@nombre" picks one (RF-8). */
  calendars: readonly { id: string; name: string }[];
  /** What the form shows when the phrase gives no date or time. */
  fallback: { date: string; startTime: string };
  onApply: (event: ResolvedEvent) => void;
  /** "+" and N open the form here (RF-13). */
  autoFocus?: boolean;
}) {
  function understand(next: string): Understood | null {
    if (!next.trim()) return null;
    const parsed = parseEventText(next, todayKey(timeZone));
    const matchable: MatchableCalendar[] = calendars.map(({ id, name }) => ({
      id,
      name,
      writable: true,
      reason: null,
    }));
    return {
      segments: highlight(next, parsed.spans),
      event: resolveParsed(parsed, {
        timeZone,
        defaultMinutes,
        calendars: matchable,
        fallback,
      }),
    };
  }

  const [text, setText] = useState(defaultText);
  const [understood, setUnderstood] = useState<Understood | null>(() =>
    understand(defaultText),
  );

  function read(next: string) {
    setText(next);
    setUnderstood(understand(next));
  }

  function apply() {
    if (understood) onApply(understood.event);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Intro applies; it never submits the form around it (RF-12).
    if (event.key !== "Enter") return;
    event.preventDefault();
    apply();
  }

  return (
    <div className="flex flex-col gap-2">
      <TextField
        label="Escribe el evento"
        // Never sent: the form gets what "Aplicar" fills in.
        name="phrase"
        form="none"
        placeholder="Cena con Ana el viernes a las 21"
        value={text}
        onChange={(event) => read(event.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={300}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
      />
      <div aria-live="polite" className="flex flex-col gap-1 text-sm">
        {understood ? (
          <>
            {/* The recognized parts, underlined: never by colour alone (RNF-3). */}
            <p aria-hidden="true" className="break-words text-muted">
              {understood.segments.map((segment, i) =>
                segment.kind ? (
                  <span
                    key={i}
                    className="text-accent-ink underline decoration-2 underline-offset-2"
                  >
                    {segment.text}
                  </span>
                ) : (
                  <span key={i}>{segment.text}</span>
                ),
              )}
            </p>
            <p className="font-medium text-ink">
              {previewText(understood.event)}
            </p>
            {understood.event.warnings.map((warning) => (
              <p key={warning} className="text-muted">
                {warning}
              </p>
            ))}
          </>
        ) : null}
      </div>
      <Button
        variant="secondary"
        onClick={apply}
        disabled={!understood}
        className="self-start"
      >
        Aplicar
      </Button>
    </div>
  );
}
