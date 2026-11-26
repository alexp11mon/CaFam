"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SHORTCUTS } from "@/lib/calendar/shortcuts";
import { useT } from "@/components/i18n/locale-provider";

/** ?: every shortcut, read from the same table as the keys (spec 017 RF-62, plan D16). */
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-control surface-float p-6 text-ink backdrop:bg-scrim/50"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {t("Atajos de teclado")}
      </h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="contents">
            <dt className="justify-self-start rounded-block bg-stone px-2 py-0.5 font-semibold tabular-nums">
              {shortcut.keys}
            </dt>
            <dd>{shortcut.description}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={() => dialog.current?.close()}>
          {t("Cerrar")}
        </Button>
      </div>
    </dialog>
  );
}
