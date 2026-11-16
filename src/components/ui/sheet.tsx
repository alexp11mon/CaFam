"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/shell/icons";
import { IconButton } from "./icon-button";

/**
 * A window from the bottom of the screen, where the thumb is (constitution,
 * amendment 10; spec 025 RF-6, plan D10). A native modal <dialog>: the focus
 * trap, Escape and the inert page come with it, and closing gives the focus
 * back to what opened it. From 769 px it is a centered window.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Stays at the bottom while the content scrolls: the main action. */
  footer?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const sheet = dialog.current;
    if (!sheet) return;
    if (open && !sheet.open) sheet.showModal();
    else if (!open && sheet.open) sheet.close();
    // A page hidden by Activity keeps its DOM: an open modal there would
    // leave the visible page inert (spec 008, AGENTS trap).
    return () => {
      if (sheet.open) sheet.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      data-sheet=""
      aria-labelledby={titleId}
      onClose={onClose}
      // The backdrop is the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-full overflow-hidden rounded-t-card surface-float p-0 text-ink backdrop:bg-scrim/50 tab:m-auto tab:max-w-lg tab:rounded-card"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex items-center justify-between gap-3 py-2 pr-2 pl-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton label="Cerrar" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-line px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
