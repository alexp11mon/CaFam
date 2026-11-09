"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  checkProposal,
  createProposedEvents,
} from "@/app/dashboard/assistant/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { TimeField } from "@/components/ui/time-field";
import {
  canCreate,
  createLabel,
  rowError,
} from "@/lib/assistant/proposal-rows";
import type { ProposalRow } from "@/lib/assistant/schemas";
import { startOptions } from "@/lib/calendar/time-options";
import type { ChatCalendar, ChatProposal } from "./assistant-chat";

// The proposal in the thread (spec 022 plan "proposal-card"). Nothing is
// written until "Crear" (RF-40); the rows live in the chat so a correction
// carries them as the user left them (RF-33).

export const DUPLICATE_TEXT = "Ya existe un evento a esta hora";
const CHECK_DELAY_MS = 500;
const OPTIONS = startOptions();

const createdText = (n: number) =>
  n === 1 ? "Se ha creado 1 evento." : `Se han creado ${n} eventos.`;
const creatingText = (n: number) =>
  n === 1 ? "Creando 1 evento…" : `Creando ${n} eventos…`;

export function ProposalCard({
  proposal,
  calendars,
  onChange,
}: {
  proposal: ChatProposal;
  calendars: readonly ChatCalendar[];
  onChange: (next: ChatProposal) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [creating, setCreating] = useState(false);
  // R5: locked before the first await, so a double press sends once.
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const version = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const live = proposal.status === "pending";
  const selected = proposal.rows.filter((row) => row.selected).length;

  function edit(key: string, change: Partial<ProposalRow>, recheck: boolean) {
    const next = {
      ...proposal,
      rows: proposal.rows.map((row) =>
        row.key === key ? { ...row, ...change } : row,
      ),
    };
    onChange(next);
    version.current += 1;
    if (!recheck) return;
    // RF-39: duplicates and permissions again, once the user stops typing.
    clearTimeout(timer.current);
    const asked = version.current;
    timer.current = setTimeout(async () => {
      const result = await checkProposal(next.rows);
      if (asked !== version.current) return;
      if ("error" in result) return setFormError(result.error);
      setErrors(result.errors);
      onChange({ ...next, rows: result.rows });
    }, CHECK_DELAY_MS);
  }

  async function create() {
    if (busy.current || !canCreate(proposal.rows)) return;
    busy.current = true;
    clearTimeout(timer.current);
    version.current += 1;
    setCreating(true);
    setFormError(undefined);
    try {
      const result = await createProposedEvents(proposal.rows);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      // RF-46: created rows leave; failed ones stay with their reason.
      const failed: Record<string, string> = {};
      const created = [...(proposal.created ?? [])];
      for (const outcome of result.results) {
        if (outcome.ok) {
          const row = proposal.rows.find((r) => r.key === outcome.key);
          created.push({ id: outcome.id, title: row?.title.trim() ?? "" });
        } else {
          failed[outcome.key] = outcome.error;
        }
      }
      const done = new Set(
        result.results.filter((r) => r.ok).map((r) => r.key),
      );
      const rows = proposal.rows.filter((row) => !done.has(row.key));
      setErrors(failed);
      onChange({
        ...proposal,
        rows,
        created,
        // RF-48: nothing left to create.
        status: rows.some((row) => row.selected) ? "pending" : "created",
      });
    } finally {
      busy.current = false;
      setCreating(false);
    }
  }

  return (
    <section
      aria-label="Propuesta de eventos"
      className="mt-3 flex flex-col gap-3"
    >
      {proposal.status !== "pending" ? (
        <p className="self-start rounded-full border border-control px-3 py-1 text-sm font-semibold text-muted">
          {proposal.status === "created" ? "Creada" : "Sustituida"}
        </p>
      ) : null}

      {proposal.status !== "created"
        ? proposal.rows.map((row, index) => (
            <RowFields
              key={row.key}
              row={row}
              index={index}
              calendars={calendars}
              disabled={!live || creating}
              error={rowError(row) ?? errors[row.key]}
              onEdit={(change, recheck) => edit(row.key, change, recheck)}
            />
          ))
        : null}

      {proposal.created?.length ? (
        <div className="flex flex-col gap-1">
          <p className="font-semibold">
            {createdText(proposal.created.length)}
          </p>
          <ul className="flex flex-col gap-1">
            {proposal.created.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="underline decoration-control underline-offset-4"
                >
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}

      {live ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={creating || !canCreate(proposal.rows)}
            onClick={() => void create()}
          >
            {createLabel(selected)}
          </Button>
          <p role="status" className="text-sm text-muted">
            {creating ? creatingText(selected) : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function RowFields({
  row,
  index,
  calendars,
  disabled,
  error,
  onEdit,
}: {
  row: ProposalRow;
  index: number;
  calendars: readonly ChatCalendar[];
  disabled: boolean;
  error: string | null | undefined;
  onEdit: (change: Partial<ProposalRow>, recheck: boolean) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const duplicateId = `${id}-duplicate`;
  const describedBy = [
    error ? errorId : null,
    row.duplicate ? duplicateId : null,
  ].filter(Boolean);
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy.join(" ") || undefined}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3"
    >
      <legend className="sr-only">{`Evento ${index + 1}`}</legend>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={row.selected}
            onChange={(event) =>
              onEdit({ selected: event.target.checked }, false)
            }
            className="size-5 accent-ink"
          />
          Crear este evento
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={row.allDay}
            onChange={(event) =>
              onEdit(
                event.target.checked
                  ? { allDay: true, start: null, end: null }
                  : {
                      allDay: false,
                      start: row.start ?? "09:00",
                      end: row.end ?? "10:00",
                    },
                true,
              )
            }
            className="size-5 accent-ink"
          />
          Todo el día
        </label>
      </div>
      <TextField
        label="Título"
        name={`${row.key}-title`}
        value={row.title}
        maxLength={100}
        onChange={(event) => onEdit({ title: event.target.value }, false)}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Fecha de inicio"
          name={`${row.key}-start-date`}
          type="date"
          value={row.startDate}
          onChange={(event) =>
            event.target.value &&
            onEdit({ startDate: event.target.value }, true)
          }
        />
        {row.allDay ? null : (
          <TimeField
            label="Hora de inicio"
            name={`${row.key}-start`}
            value={row.start ?? ""}
            options={OPTIONS}
            onValueChange={(start) => onEdit({ start }, true)}
          />
        )}
        <TextField
          label="Fecha de fin"
          name={`${row.key}-end-date`}
          type="date"
          value={row.endDate}
          onChange={(event) =>
            event.target.value && onEdit({ endDate: event.target.value }, true)
          }
        />
        {row.allDay ? null : (
          <TimeField
            label="Hora de fin"
            name={`${row.key}-end`}
            value={row.end ?? ""}
            options={OPTIONS}
            onValueChange={(end) => onEdit({ end }, true)}
          />
        )}
      </div>
      <Select
        label="Calendario"
        name={`${row.key}-calendar`}
        value={row.calendarId}
        onChange={(event) => onEdit({ calendarId: event.target.value }, true)}
      >
        {calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            {calendar.name}
          </option>
        ))}
      </Select>
      {row.duplicate ? (
        <p id={duplicateId} className="text-sm font-medium text-muted">
          {DUPLICATE_TEXT}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
