"use client";

import { useEffect, useRef } from "react";
import { undoAssistantAction } from "@/app/dashboard/assistant/write-actions";
import { useUndoStack } from "@/components/calendar/undo-stack";
import { undoLabel } from "@/lib/calendar/undo-stack";
import { needsConfirm, type AssistantUndo } from "@/lib/assistant/actions";
import type { ChatAction } from "./action-card";

// What Venito created or changed goes on the stack of the tab too, so Ctrl/⌘+Z
// undoes it from the calendar (spec 046 RF-11). Without "Rehacer": the card
// is where it is created again. Each token is stacked once.

function undoOf(card: ChatAction): AssistantUndo | null {
  const { action } = card;
  if (
    (action.kind === "created" || action.kind === "note") &&
    card.status === "done"
  )
    return action.undo;
  if (needsConfirm(action) && card.status === "applied")
    return card.undo ?? null;
  return null;
}

function titleOf(card: ChatAction): string {
  const { action } = card;
  return action.kind === "note"
    ? action.note.title
    : action.kind === "change"
      ? action.after.title
      : action.event.title;
}

const VERBS: Record<ChatAction["action"]["kind"], string> = {
  created: "Evento creado",
  note: "Nota",
  change: "cambiar",
  delete: "Evento borrado",
  series: "Serie creada",
};

/** Each token once: a deletion is told by its copy in the trash. */
const keyOf = (undo: AssistantUndo) =>
  undo.kind === "restore"
    ? `restore:${undo.trashId}`
    : `${undo.kind}:${undo.id}:${undo.updatedAt}:${"itemIds" in undo ? (undo.itemIds?.join() ?? "") : ""}`;

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
        const key = keyOf(undo);
        if (stacked.current.has(key)) continue;
        stacked.current.add(key);
        stack.record(
          undoLabel(VERBS[card.action.kind], titleOf(card)),
          null,
          async () => {
            const result = await undoAssistantAction(undo);
            if (result.ok) onChanged?.();
            return result.ok
              ? { ok: true }
              : { ok: false, error: result.error };
          },
        );
      }
    }
  }, [messages, stack, onChanged]);
}
