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

const ToastContext = createContext<{ show: (text: string) => void }>({
  show: () => {},
});

/** Shows a short notice from anywhere inside the app frame (spec 008 RF-32, plan D8). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  // A new id restarts the countdown even when the text repeats.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const show = useCallback(
    (text: string) => setToast({ id: Date.now(), text }),
    [],
  );
  const value = useMemo(() => ({ show }), [show]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

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
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-on-ink shadow-float"
          >
            {toast.text}
          </p>
        ) : null}
      </div>
    </ToastContext>
  );
}
