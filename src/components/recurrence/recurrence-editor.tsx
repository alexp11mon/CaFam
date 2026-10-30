"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { addDays, parseDateKey, weekdayIndex } from "@/lib/calendar/time-zone";
import { fromRRule, toRRule, type Weekday } from "@/lib/recurrence/rule";
import { recurrenceRuleSchema, WEEKDAYS } from "@/lib/recurrence/schemas";
import { summarizeRule, WEEKDAY_NAMES } from "@/lib/recurrence/summary";

type Freq = "daily" | "weekly" | "monthly" | "yearly";
type MonthlyMode = "day" | "pos" | "last";
type EndKind = "never" | "until" | "count";

const UNITS: { value: Freq; one: string; many: string }[] = [
  { value: "daily", one: "día", many: "días" },
  { value: "weekly", one: "semana", many: "semanas" },
  { value: "monthly", one: "mes", many: "meses" },
  { value: "yearly", one: "año", many: "años" },
];

const LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

const FIELD =
  "rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20";

/** "Personalizado…" of the "Repetir" field (RF-3, RF-4, RF-5), whole with the keyboard. */
export function RecurrenceEditor({
  open,
  startDate,
  allDay,
  initial,
  onSave,
  onCancel,
}: {
  open: boolean;
  /** YYYY-MM-DD of the event: the defaults and the monthly options come from it. */
  startDate: string;
  allDay: boolean;
  /** RRULE to start from, or null for "every week on the day of the start". */
  initial: string | null;
  onSave: (rrule: string) => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Editor
      startDate={startDate}
      allDay={allDay}
      initial={initial}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
}

function Editor({
  startDate,
  allDay,
  initial,
  onSave,
  onCancel,
}: Omit<Parameters<typeof RecurrenceEditor>[0], "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const id = useId();
  const date = parseDateKey(startDate) ?? { year: 2026, month: 1, day: 1 };
  const weekday: Weekday = parseDateKey(startDate)
    ? WEEKDAYS[weekdayIndex(startDate)]!
    : "MO";
  const position = Math.ceil(date.day / 7);
  const isLast =
    parseDateKey(startDate) !== null &&
    parseDateKey(addDays(startDate, 7))!.month !== date.month;

  const start = fromRRule(initial ?? "");
  const [interval, setInterval] = useState(String(start?.interval ?? 1));
  const [freq, setFreq] = useState<Freq>(start?.freq ?? "weekly");
  const [days, setDays] = useState<Weekday[]>(
    start?.freq === "weekly" ? start.byDay : [weekday],
  );
  const [monthly, setMonthly] = useState<MonthlyMode>(
    start?.freq === "monthly" && "pos" in start.monthly
      ? start.monthly.pos === -1
        ? "last"
        : "pos"
      : "day",
  );
  const [endKind, setEndKind] = useState<EndKind>(start?.end.kind ?? "never");
  const [until, setUntil] = useState(
    start?.end.kind === "until" ? start.end.date : addDays(startDate, 30),
  );
  const [count, setCount] = useState(
    String(start?.end.kind === "count" ? start.end.count : 10),
  );

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  const end =
    endKind === "never"
      ? { kind: "never" }
      : endKind === "until"
        ? { kind: "until", date: until }
        : { kind: "count", count: Number(count) };
  const parsed = recurrenceRuleSchema.safeParse({
    freq,
    interval: Number(interval),
    end,
    ...(freq === "weekly" ? { byDay: sortDays(days) } : {}),
    ...(freq === "monthly"
      ? {
          monthly:
            monthly === "day"
              ? { day: date.day }
              : { pos: monthly === "last" ? -1 : position, weekday },
        }
      : {}),
    ...(freq === "yearly"
      ? { yearly: { month: date.month, day: date.day } }
      : {}),
  });
  const numbersOk =
    isWhole(interval, 1, 99) && (endKind !== "count" || isWhole(count, 1, 999));
  const many = Number(interval) !== 1;
  const weekdayName = WEEKDAY_NAMES[weekdayIndexOf(weekday)];

  function toggle(day: Weekday) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day],
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // Enter in a field must not submit the event form around the dialog.
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
        }
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl glass-float p-6 text-ink backdrop:bg-scrim/50"
    >
      <div className="flex flex-col gap-5">
        <h2 id={titleId} className="text-lg font-bold">
          Repetición personalizada
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-interval`} className="text-sm font-medium">
              Repetir cada
            </label>
            <input
              id={`${id}-interval`}
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className={`${FIELD} min-h-11 w-20 tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-unit`} className="sr-only">
              Unidad
            </label>
            <select
              id={`${id}-unit`}
              value={freq}
              onChange={(event) => setFreq(event.target.value as Freq)}
              className={`${FIELD} min-h-11`}
            >
              {UNITS.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {many ? unit.many : unit.one}
                </option>
              ))}
            </select>
          </div>
        </div>

        {freq === "weekly" ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">
              Días de la semana
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, index) => (
                <label
                  key={day}
                  className="flex min-h-11 items-center gap-1.5 rounded-full border border-control bg-paper px-3 has-checked:border-ink has-checked:bg-ink has-checked:text-on-ink"
                >
                  <input
                    type="checkbox"
                    aria-label={WEEKDAY_NAMES[index]}
                    checked={days.includes(day)}
                    onChange={() => toggle(day)}
                    className="size-4 accent-ink"
                  />
                  <span aria-hidden="true">{LETTERS[index]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {freq === "monthly" ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">Cada mes</legend>
            <Choice
              name={`${id}-monthly`}
              label={`El día ${date.day}`}
              checked={monthly === "day"}
              onChange={() => setMonthly("day")}
            />
            {position <= 4 ? (
              <Choice
                name={`${id}-monthly`}
                label={`El ${position}.º ${weekdayName}`}
                checked={monthly === "pos"}
                onChange={() => setMonthly("pos")}
              />
            ) : null}
            {isLast ? (
              <Choice
                name={`${id}-monthly`}
                label={`El último ${weekdayName}`}
                checked={monthly === "last"}
                onChange={() => setMonthly("last")}
              />
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Termina</legend>
          <Choice
            name={`${id}-end`}
            label="Nunca"
            checked={endKind === "never"}
            onChange={() => setEndKind("never")}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Choice
              name={`${id}-end`}
              label="El"
              checked={endKind === "until"}
              onChange={() => setEndKind("until")}
            />
            <label htmlFor={`${id}-until`} className="sr-only">
              Fecha de fin de la repetición
            </label>
            <input
              id={`${id}-until`}
              type="date"
              value={until}
              disabled={endKind !== "until"}
              onChange={(event) => setUntil(event.target.value)}
              className={`${FIELD} min-h-11 disabled:opacity-60`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Choice
              name={`${id}-end`}
              label="Tras"
              checked={endKind === "count"}
              onChange={() => setEndKind("count")}
            />
            <label htmlFor={`${id}-count`} className="sr-only">
              Número de repeticiones
            </label>
            <input
              id={`${id}-count`}
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={count}
              disabled={endKind !== "count"}
              onChange={(event) => setCount(event.target.value)}
              className={`${FIELD} min-h-11 w-24 tabular-nums disabled:opacity-60`}
            />
            <span aria-hidden="true">repeticiones</span>
          </div>
        </fieldset>

        <p role="status" aria-live="polite" className="font-semibold">
          {parsed.success ? summarizeRule(parsed.data) : ""}
        </p>
        {numbersOk ? null : (
          <p className="text-sm text-danger">
            Revisa la repetición: cada 1 a 99, de 1 a 999 veces.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!parsed.success || !numbersOk}
            onClick={() => {
              if (parsed.success) onSave(toRRule(parsed.data, allDay));
            }}
          >
            Hecho
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function Choice({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-5 accent-ink"
      />
      {label}
    </label>
  );
}

function isWhole(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max;
}

function weekdayIndexOf(day: Weekday): number {
  return WEEKDAYS.indexOf(day);
}

function sortDays(days: Weekday[]): Weekday[] {
  return [...days].sort((a, b) => weekdayIndexOf(a) - weekdayIndexOf(b));
}
