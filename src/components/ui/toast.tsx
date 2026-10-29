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
// The last part of it fades the notice out (spec 011 RF-20, plan overlay-motion).
const LEAVING_MS = 200;

const ToastContext = createContext<{ show: (text: string) => void }>({
  show: () => {},
});

/** Shows a short notice from anywhere inside the app frame (spec 008 RF-32, plan D8). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  // A new id restarts the countdown even when the text repeats.
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    leaving?: boolean;
  } | null>(null);
  const show = useCallback(
    (text: string) => setToast({ id: Date.now(), text }),
    [],
  );
  const id = toast?.id;
  const value = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (id === undefined) return;
    const leave = setTimeout(
      () => setToast((current) => current && { ...current, leaving: true }),
      DURATION_MS - LEAVING_MS,
    );
    const remove = setTimeout(() => setToast(null), DURATION_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [id]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Always in the DOM so screen readers hear every new message. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-28 z-50 flex justify-center lg:bottom-6"
      >
        {toast ? (
          <p
            key={toast.id}
            data-toast=""
            data-leaving={toast.leaving ? "" : undefined}
            className="rounded-full glass-float px-5 py-3 text-sm font-semibold text-ink"
          >
            {toast.text}
          </p>
        ) : null}
      </div>
    </ToastContext>
  );
}
