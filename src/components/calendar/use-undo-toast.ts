"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { undoAction } from "@/app/dashboard/events/quick-actions";
import { useToast } from "@/components/ui/toast";
import type { UndoToken } from "@/lib/calendar/undo";
import { captureReturn } from "@/lib/motion/marks";

/**
 * Shows a notice with "Deshacer" when the action left an undo token
 * (spec 017 RF-24 to RF-27); the views refresh after undoing.
 */
export function useUndoToast() {
  const { show } = useToast();
  const router = useRouter();
  return useCallback(
    (text: string, undo?: UndoToken) =>
      show(
        text,
        undo
          ? {
              undo: async () => {
                const result = await undoAction(undo);
                // A moved or stretched event flies back to its place (spec 021 RF-20).
                if (
                  result.ok &&
                  undo.kind === "change" &&
                  undo.before.kind === "times"
                )
                  captureReturn(undo.id);
                router.refresh();
                return result.ok ? null : result.error;
              },
            }
          : undefined,
      ),
    [show, router],
  );
}
