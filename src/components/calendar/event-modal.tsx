"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CloseIcon, ExpandIcon } from "@/components/shell/icons";

const ICON_BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Window of an intercepted event route over the calendar (spec 008 RF-4..RF-6,
 * RF-12, RF-29, plan D1). Native modal <dialog>: focus trap and dimmed backdrop
 * come for free. Closing goes back in history, which unmounts the route.
 */
export function EventModal({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    // Whatever had the focus opened the window: it gets it back on close (RF-6).
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      // Next keeps a left route hidden in the DOM (Activity): a modal <dialog> left
      // open there would keep the page behind it inert.
      element?.close();
      opener?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-fullscreen={fullscreen}
      onCancel={(event) => {
        // Escape: leave through history like "Cerrar", not by closing the element.
        event.preventDefault();
        router.back();
      }}
      // Up to 768 px the window is always full screen (RF-29).
      className={`flex-col overflow-hidden bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/40 open:flex max-[48.0625rem]:m-0 max-[48.0625rem]:h-full max-[48.0625rem]:max-h-none max-[48.0625rem]:w-full max-[48.0625rem]:max-w-none max-[48.0625rem]:rounded-none ${fullscreen ? "m-0 h-full max-h-none w-full max-w-none rounded-none" : "m-auto max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-2xl rounded-3xl"}`}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-2 sm:px-6">
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate text-lg font-bold text-ink"
        >
          {title}
        </h2>
        <button
          type="button"
          aria-pressed={fullscreen}
          aria-label="Pantalla completa"
          onClick={() => setFullscreen((value) => !value)}
          className={`${ICON_BUTTON} max-[48.0625rem]:hidden`}
        >
          <ExpandIcon expanded={fullscreen} />
        </button>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => router.back()}
          className={ICON_BUTTON}
        >
          <CloseIcon />
        </button>
      </header>
      <div
        className={`flex-1 overflow-y-auto px-4 py-5 sm:px-6 ${fullscreen ? "mx-auto w-full max-w-2xl" : ""}`}
      >
        {children}
      </div>
    </dialog>
  );
}
