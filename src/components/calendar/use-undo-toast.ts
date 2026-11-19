"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { undoAction } from "@/app/dashboard/events/quick-actions";
import { useToast } from "@/components/ui/toast";
import { UNDO_ERRORS, type UndoToken } from "@/lib/calendar/undo";
import { isOnline } from "@/lib/offline/connection";
import { undoChange } from "@/lib/offline/queue-store";
import { captureReturn } from "@/lib/motion/marks";
import { undoLabel, type Step } from "@/lib/calendar/undo-stack";
import { useUndoStack } from "./undo-stack";

/**
 * The step of the stack for a token: undoes it and answers with the step that
 * redoes it (spec 046 RF-11, RF-12). Each run refreshes the views.
 */
export function tokenStep(token: UndoToken, refresh: () => void): Step {
  return async () => {
    // Still waiting on the device: it leaves the queue (spec 034 RF-30).
    if (token.kind === "offline") {
      return (await undoChange(token.changeId))
        ? { ok: true }
        : { ok: false, error: UNDO_ERRORS.expired };
    }
    const result = await undoAction(token);
    // A moved or stretched event flies back to its place (spec 021 RF-20).
    if (result.ok && token.kind === "change" && token.before.kind === "times")
      captureReturn(token.id);
    refresh();
    if (!result.ok) return result;
    return result.inverse
      ? { ok: true, inverse: tokenStep(result.inverse, refresh) }
      : { ok: true };
  };
}

/**
 * Shows a notice with "Deshacer" when the action left an undo token and puts
 * it on the stack of the tab (spec 017 RF-24 to RF-27; spec 046 RF-11).
 */
export function useUndoToast() {
  const { show } = useToast();
  const stack = useUndoStack();
  const router = useRouter();
  return useCallback(
    (text: string, undo?: UndoToken, title?: string) => {
      const refresh = () => {
        if (isOnline()) router.refresh();
      };
      if (!undo) return show(text);
      const step = tokenStep(undo, refresh);
      if (stack) return stack.record(undoLabel(text, title), text, step);
      // Outside the app frame: the notice alone, as before the stack.
      show(text, {
        undo: async () => {
          const result = await step();
          return result.ok ? null : result.error;
        },
      });
    },
    [show, stack, router],
  );
}
