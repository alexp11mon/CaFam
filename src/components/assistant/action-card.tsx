"use client";

import { useState } from "react";
import {
  confirmChange,
  undoAssistantAction,
} from "@/app/dashboard/assistant/write-actions";
import { lossText } from "@/components/recurrence/series-scope-dialog";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  describeAction,
  whenText,
  type ActionEvent,
  type ActionStatus,
  type AssistantAction,
  type AssistantUndo,
  type ChangeScope,
} from "@/lib/assistant/actions";

// Spec 036: a card in the chat for what Venito created or proposes to change
// (RF-17, RF-24 to RF-24d, RF-30, RF-32 to RF-37; plan D4, D8).

/** A card as the conversation keeps it, in memory only. */
export interface ChatAction {
  action: AssistantAction;
  status: ActionStatus;
  /** Why the last step failed, said on the card. */
  error?: string;
  /** What "Deshacer" sends once the change is applied (RF-35). */
  undo?: AssistantUndo;
}

export type CardStep = "confirm" | "cancel" | "undo";

/**
 * One step of a card: also run by the chat when the user answers "sí" or
 * "no" (plan D5). Returns the card as it is afterwards.
 */
export async function runCardStep(
  card: ChatAction,
  step: CardStep,
): Promise<ChatAction> {
  if (step === "cancel")
    return { ...card, status: "cancelled", error: undefined };
  if (step === "confirm") {
    if (card.action.kind !== "change") return card;
    const result = await confirmChange(card.action.change);
    return result.ok
      ? { ...card, status: "applied", error: undefined, undo: result.undo }
      : { ...card, status: "failed", error: result.error };
  }
  const undo = card.action.kind === "change" ? card.undo : card.action.undo;
  if (!undo) return card;
  const result = await undoAssistantAction(undo);
  return result.ok
    ? { ...card, status: "undone", error: undefined }
    : { ...card, error: result.error };
}

/** Whether the step wrote something the calendar must show (RF-38). */
export const wrote = (before: ChatAction, after: ChatAction) =>
  before.status !== after.status &&
  (after.status === "applied" || after.status === "undone");

const LABELS: Record<ActionStatus, string> = {
  done: "Evento creado",
  pending: "Cambio pendiente",
  applied: "Cambio aplicado",
  cancelled: "Cancelado",
  superseded: "Sustituido",
  undone: "Deshecho",
  failed: "No aplicado",
};

const SCOPES: Record<ChangeScope, string> = {
  this: "Solo este evento de la serie.",
  following: "Este y los siguientes de la serie.",
  all: "Todos los eventos de la serie.",
};

function EventLines({
  event,
  timeZone,
  label,
}: {
  event: ActionEvent;
  timeZone: string;
  label?: string;
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-3">
      {/* The calendar's color is data, so it goes in style (P9). */}
      <span
        aria-hidden="true"
        className="w-1 shrink-0 rounded-full ring-1 ring-pastel-ink/20"
        style={{ backgroundColor: event.color }}
      />
      <div className="flex min-w-0 flex-col">
        {label ? (
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            {label}
          </span>
        ) : null}
        <span className="font-semibold break-words">{event.title}</span>
        <span className="text-sm text-muted tabular-nums">
          {whenText(event, timeZone)}
        </span>
        <span className="text-sm break-words text-muted">
          {event.calendarName}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </div>
    </div>
  );
}

export function ActionCard({
  card,
  timeZone,
  onChange,
  onChanged,
}: {
  card: ChatAction;
  timeZone: string;
  onChange: (card: ChatAction) => void;
  /** Something was written: the calendar behind must refresh (RF-38). */
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { action, status } = card;

  async function step(name: CardStep) {
    if (busy) return;
    setBusy(true);
    try {
      const next = await runCardStep(card, name);
      onChange(next);
      if (wrote(card, next)) onChanged?.();
    } catch {
      onChange({
        ...card,
        error: "No se ha podido conectar. Inténtalo de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  const canUndo =
    (action.kind !== "change" && status === "done") ||
    (action.kind === "change" && status === "applied" && card.undo);
  const open =
    status === "done" || status === "applied"
      ? action.kind === "created"
        ? {
            href: `/dashboard/events/${action.event.id}`,
            title: action.event.title,
          }
        : action.kind === "note"
          ? {
              href: `/dashboard/notes/${action.note.id}`,
              title: action.note.title,
            }
          : {
              href: `/dashboard/events/${action.after.id}`,
              title: action.after.title,
            }
      : null;

  return (
    <section
      aria-label={describeAction(action, timeZone, status)}
      className="mt-3 flex flex-col gap-3 rounded-control border border-line bg-stone/60 p-3 text-ink"
    >
      <p
        className={`text-sm font-semibold ${
          status === "pending" || status === "done" || status === "applied"
            ? "text-accent-ink"
            : "text-muted"
        }`}
      >
        {action.kind === "note" && status === "done"
          ? action.added
            ? "Añadido a la nota"
            : "Nota creada"
          : action.kind === "created" && status === "done"
            ? LABELS.done
            : LABELS[status]}
      </p>

      {action.kind === "created" ? (
        <>
          <EventLines event={action.event} timeZone={timeZone} />
          {action.anchor ? (
            // RF-17: which event it was placed against.
            <p className="text-sm text-muted">
              {Date.parse(action.anchor.endsAt) <=
              Date.parse(action.event.startsAt)
                ? "Al acabar"
                : "Antes de"}{" "}
              {action.anchor.title} ({whenText(action.anchor, timeZone)})
            </p>
          ) : null}
        </>
      ) : action.kind === "note" ? (
        // Spec 048 RF-12: the note and what was written in it.
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{action.note.title || "(Sin título)"}</p>
          {action.note.items.length ? (
            <ul className="list-disc pl-5 text-sm">
              {action.note.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted">
            {action.note.calendarName
              ? `Compartida en ${action.note.calendarName}`
              : "Personal"}
          </p>
        </div>
      ) : (
        <>
          {/* Once applied or undone, the two sides are history. */}
          <EventLines
            event={action.before}
            timeZone={timeZone}
            label={
              status === "pending" || status === "failed" ? "Ahora" : "Antes"
            }
          />
          <EventLines
            event={action.after}
            timeZone={timeZone}
            label={
              status === "pending" || status === "failed"
                ? "Quedará"
                : "Después"
            }
          />
          {action.scope ? (
            <p className="text-sm text-muted">
              {SCOPES[action.scope]}
              {action.loss ? ` ${lossText(action.loss)}` : ""}
            </p>
          ) : null}
          {status === "applied" && !card.undo ? (
            <p className="text-sm text-muted">
              Este cambio afecta a varios eventos y no se puede deshacer.
            </p>
          ) : null}
        </>
      )}

      {card.error ? (
        <p role="alert" className="text-sm text-danger">
          {card.error}
        </p>
      ) : null}

      {action.kind === "change" &&
      (status === "pending" || status === "failed") ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => void step("confirm")}>
            Confirmar
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onClick={() => void step("cancel")}
          >
            Cancelar
          </Button>
        </div>
      ) : null}

      {open || canUndo ? (
        <div className="flex flex-wrap gap-2">
          {open ? (
            <LinkButton
              variant="secondary"
              href={open.href}
              prefetch={false}
              aria-label={`Abrir ${open.title}`}
            >
              Abrir
            </LinkButton>
          ) : null}
          {canUndo ? (
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => void step("undo")}
            >
              Deshacer
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
