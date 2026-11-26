"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast";
import { isTyping } from "@/lib/calendar/shortcuts";
import {
  EMPTY_STACK,
  pushAction,
  settle,
  take,
  type Step,
  type UndoStack,
} from "@/lib/calendar/undo-stack";
import { useT } from "@/components/i18n/locale-provider";

// The stack of the tab (spec 046 RF-11 to RF-17, plan D4): every action that
// offers "Deshacer" goes on top; Ctrl/⌘+Z undoes the last one even after its
// notice left, Ctrl/⌘+Mayús+Z or Ctrl+Y redoes. Never typing in a field nor
// with a modal window open (RF-12).

/** notice null: on the stack without a notice (Venito's cards say it). */
type Record_ = (label: string, notice: string | null, step: Step) => void;

const UndoStackContext = createContext<{ record: Record_ } | null>(null);

export const NOTHING = {
  undo: "No hay nada que deshacer.",
  redo: "No hay nada que rehacer.",
} as const;

/** A modal <dialog> blocks the shortcuts (RF-12); the non-modal card does not. */
function modalOpen(): boolean {
  for (const dialog of document.querySelectorAll("dialog[open]")) {
    try {
      if (dialog.matches(":modal")) return true;
    } catch {
      // Without :modal, a sheet or window counts as modal.
      return true;
    }
  }
  return false;
}

export function UndoStackProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const { show } = useToast();
  const stack = useRef<UndoStack>(EMPTY_STACK);
  const busy = useRef(false);
  // The notice's button runs the other side: through a ref, as run is the
  // callback being defined.
  const runRef = useRef<(side: "undo" | "redo") => Promise<void>>(
    async () => {},
  );

  const run = useCallback(
    async (side: "undo" | "redo"): Promise<void> => {
      if (busy.current) return;
      const taken = take(stack.current, side);
      if (!taken) {
        show(NOTHING[side]);
        return;
      }
      busy.current = true;
      stack.current = taken.stack;
      try {
        const result = await taken.entry.step();
        stack.current = settle(stack.current, side, taken.entry, result);
        if (!result.ok) {
          // Someone changed it: it leaves the stack, with the reason (RF-13).
          show(result.error);
          return;
        }
        const done = side === "undo" ? t("Deshecho") : t("Rehecho");
        show(
          `${done}: ${taken.entry.label}`,
          result.inverse
            ? {
                undo: () => runRef.current(side === "undo" ? "redo" : "undo"),
                label: side === "undo" ? t("Rehacer") : t("Deshacer"),
                keys: false,
              }
            : undefined,
        );
      } catch {
        show(
          t(
            "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.",
          ),
        );
      } finally {
        busy.current = false;
      }
    },
    [show, t],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const record = useCallback<Record_>(
    (label, notice, step) => {
      stack.current = pushAction(stack.current, { label, step });
      if (notice !== null)
        show(notice, { undo: () => run("undo"), keys: false });
    },
    [show, run],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const redo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.shiftKey);
      const undo = key === "z" && !event.shiftKey;
      if (!undo && !redo) return;
      // In a text field it is the browser's own undo.
      if (isTyping(event.target) || modalOpen()) return;
      event.preventDefault();
      void run(undo ? "undo" : "redo");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [run]);

  const value = useMemo(() => ({ record }), [record]);
  return <UndoStackContext value={value}>{children}</UndoStackContext>;
}

/** null outside the app frame (tests of a single component). */
export function useUndoStack() {
  return useContext(UndoStackContext);
}
