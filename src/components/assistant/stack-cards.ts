"use client";

import { useEffect, useRef } from "react";
import { undoAssistantAction } from "@/app/dashboard/assistant/write-actions";
import { useUndoStack } from "@/components/calendar/undo-stack";
import { undoLabel } from "@/lib/calendar/undo-stack";
import type { AssistantUndo } from "@/lib/assistant/actions";
import type { ChatAction } from "./action-card";

// What Venito created or changed goes on the stack of the tab too, so Ctrl/⌘+Z
// undoes it from the calendar (spec 046 RF-11). Without "Rehacer": the card
// is where it is created again. Each token is stacked once.

function undoOf(card: ChatAction): AssistantUndo | null {
  if (card.action.kind !== "change" && card.status === "done")
    return card.action.undo;
  if (card.action.kind === "change" && card.status === "applied")
    return card.undo ?? null;
  return null;
}

function titleOf(card: ChatAction): string {
  return card.action.kind === "created"
    ? card.action.event.title
    : card.action.kind === "note"
      ? card.action.note.title
      : card.action.after.title;
}

export function useStackCards(
  messages: readonly { actions?: ChatAction[] }[],
  onChanged?: () => void,
) {
  const stack = useUndoStack();
  const stacked = useRef(new Set<string>());
  useEffect(() => {
    if (!stack) return;
    for (const message of messages) {
      for (const card of message.actions ?? []) {
        const undo = undoOf(card);
        if (!undo) continue;
        const key = `${undo.kind}:${undo.id}:${undo.updatedAt}:${"itemIds" in undo ? (undo.itemIds?.join() ?? "") : ""}`;
        if (stacked.current.has(key)) continue;
        stacked.current.add(key);
        const verb =
          card.action.kind === "created"
            ? "Evento creado"
            : card.action.kind === "note"
              ? "Nota"
              : "cambiar";
        stack.record(undoLabel(verb, titleOf(card)), null, async () => {
          const result = await undoAssistantAction(undo);
          if (result.ok) onChanged?.();
          return result.ok ? { ok: true } : { ok: false, error: result.error };
        });
      }
    }
  }, [messages, stack, onChanged]);
}
