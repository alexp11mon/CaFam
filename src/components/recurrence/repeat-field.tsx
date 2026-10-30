"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import {
  CUSTOM_PREFIX,
  repeatOptions,
  resolveRepeat,
} from "@/lib/recurrence/presets";
import { fromRRule, toRRule } from "@/lib/recurrence/rule";
import { summarizeRule } from "@/lib/recurrence/summary";
import { RecurrenceEditor } from "./recurrence-editor";

/**
 * "Repetir" of the event form (RF-1, RF-2, RF-5). The field sends the kind of
 * quick option and the server resolves it with the date (plan D13), or
 * "custom:<RRULE>" from "Personalizado…".
 */
export function RepeatField({
  startDate,
  allDay,
  defaultValue,
  disabledReason,
  error,
  name = "repeat",
}: {
  startDate: string;
  allDay: boolean;
  defaultValue: string;
  /** Why the calendar takes no series (RF-29); the field then sends "none". */
  disabledReason?: string;
  error?: string;
  name?: string;
}) {
  const [value, setValue] = useState(defaultValue || "none");
  const [editing, setEditing] = useState(false);
  // A server response carries what was submitted: adopt it.
  const [seenDefault, setSeenDefault] = useState(defaultValue);
  if (seenDefault !== defaultValue) {
    setSeenDefault(defaultValue);
    setValue(defaultValue || "none");
  }

  const options = repeatOptions(startDate);
  const custom = value.startsWith(CUSTOM_PREFIX)
    ? fromRRule(value.slice(CUSTOM_PREFIX.length))
    : null;
  // An option the new date no longer has falls back to "No se repite".
  const current =
    custom || options.some((o) => o.value === value && o.value !== "custom")
      ? value
      : "none";
  const sent = disabledReason ? "none" : current;

  const resolved = resolveRepeat(current, startDate);
  const editorStart =
    resolved.ok && resolved.rule ? toRRule(resolved.rule, allDay) : null;

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={sent} />
      <Select
        label="Repetir"
        name={`${name}-choice`}
        form="none"
        value={disabledReason ? "none" : current}
        disabled={Boolean(disabledReason)}
        onChange={(event) => {
          if (event.target.value === "custom") setEditing(true);
          else setValue(event.target.value);
        }}
        error={error}
      >
        {options
          .filter((option) => option.value !== "custom")
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        {custom ? <option value={value}>{summarizeRule(custom)}</option> : null}
        <option value="custom">Personalizado…</option>
      </Select>
      {disabledReason ? (
        <p className="text-sm text-muted">{disabledReason}</p>
      ) : null}
      <RecurrenceEditor
        open={editing}
        startDate={startDate}
        allDay={allDay}
        initial={editorStart}
        onSave={(rrule) => {
          setValue(`${CUSTOM_PREFIX}${rrule}`);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    </div>
  );
}
