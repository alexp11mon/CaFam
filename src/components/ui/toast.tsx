"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const DURATION_MS = 4000;
// "Deshacer" stays this long (spec 017 RF-26).
const UNDO_MS = 10_000;
// The last part of it fades the notice out (spec 011 RF-20, plan overlay-motion).
const LEAVING_MS = 200;
const UNDONE = "Deshecho";

export interface ToastOptions {
  /** Undoes the action; resolves to null when undone or to why it could not be. */
  undo?: () => Promise<string | null>;
}

type Show = (text: string, options?: ToastOptions) => void;

const ToastContext = createContext<{ show: Show }>({ show: () => {} });

/** Shows a short notice from anywhere inside the app frame (spec 008 RF-32, plan D8). */
type Toast = {
  id: number;
  text: string;
  undo?: ToastOptions["undo"];
  leaving?: boolean;
};

let lastId = 0;

// Both notices share one cell, so the new one enters over the old one.
const NOTICE =
  "flex items-center gap-3 rounded-full text-sm font-semibold text-ink [grid-area:1/1]";

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  // A new id restarts the countdown even when the text repeats. A new notice
  // replaces the last one and its "Deshacer": only the last action (RF-30).
  // `previous` is the notice a new one replaced, fading out under it while
  // the new one enters (spec 021 RF-52).
  const [{ toast, previous }, setNotices] = useState<{
    toast: Toast | null;
    previous: Toast | null;
  }>({ toast: null, previous: null });
  const setToast = useCallback(
    (update: (current: Toast | null) => Toast | null) =>
      setNotices((notices) => ({ ...notices, toast: update(notices.toast) })),
    [],
  );
  const [undoing, setUndoing] = useState(false);
  const show = useCallback<Show>((text, options) => {
    const id = ++lastId;
    setNotices(({ toast: current }) => ({
      previous: current && { ...current, leaving: true },
      toast: { id, text, undo: options?.undo },
    }));
  }, []);
  const id = toast?.id;
  const duration = toast?.undo ? UNDO_MS : DURATION_MS;
  const value = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (!previous) return;
    const timer = setTimeout(
      () => setNotices((notices) => ({ ...notices, previous: null })),
      LEAVING_MS,
    );
    return () => clearTimeout(timer);
  }, [previous]);

  useEffect(() => {
    if (id === undefined) return;
    const leave = setTimeout(
      () => setToast((current) => current && { ...current, leaving: true }),
      duration - LEAVING_MS,
    );
    const remove = setTimeout(() => setToast(() => null), duration);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [id, duration, setToast]);

  async function runUndo(undo: NonNullable<ToastOptions["undo"]>) {
    setUndoing(true);
    try {
      show((await undo()) ?? UNDONE);
    } finally {
      setUndoing(false);
    }
  }

  return (
    <ToastContext value={value}>
      {children}
      {/* Always in the DOM so screen readers hear every new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-28 z-50 grid justify-items-center max-tab:group-data-[has-fab]/frame:bottom-40 tab:bottom-40 lg:bottom-6"
      >
        {previous ? (
          <p
            key={previous.id}
            data-toast=""
            data-leaving=""
            aria-hidden="true"
            inert
            className={`${NOTICE} glass-float ${previous.undo ? "py-1 pr-1 pl-5" : "px-5 py-3"}`}
          >
            {previous.text}
          </p>
        ) : null}
        {toast ? (
          <p
            key={toast.id}
            data-toast=""
            data-leaving={toast.leaving ? "" : undefined}
            className={`${NOTICE} glass-float ${toast.undo ? "py-1 pr-1 pl-5" : "px-5 py-3"}`}
          >
            {toast.text}
            {toast.undo ? (
              <button
                type="button"
                disabled={undoing}
                onClick={() => runUndo(toast.undo!)}
                className="press settle pointer-events-auto min-h-11 rounded-full px-4 font-semibold text-accent-ink hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
              >
                Deshacer
              </button>
            ) : null}
          </p>
        ) : null}
      </div>
    </ToastContext>
  );
}
