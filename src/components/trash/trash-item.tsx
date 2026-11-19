"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/calendar/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  purgeFromTrash,
  restoreFromTrash,
} from "@/app/dashboard/trash/actions";
import { formatEventWhen } from "@/lib/calendar/format";
import {
  deletedText,
  kindText,
  remainingText,
  type TrashEntry,
} from "@/lib/calendar/trash";

/** One deleted event: what it was, who deleted it and its two actions (RF-3, RF-5, RF-6). */
export function TrashItem({
  entry,
  timeZone,
  now,
}: {
  entry: TrashEntry;
  timeZone: string;
  now: Date;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const kind = kindText(entry);

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreFromTrash(entry.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      show(`«${entry.title}» restaurado`);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 tab:flex-row tab:items-start tab:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold text-ink">
          {entry.title}
          {kind ? (
            <span className="font-normal text-muted"> · {kind}</span>
          ) : null}
        </p>
        <p className="text-sm text-ink tabular-nums">
          {formatEventWhen(entry, timeZone)}
        </p>
        <p className="text-sm text-muted">
          {deletedText(entry, now)} ·{" "}
          <span className="tabular-nums">
            {remainingText(entry.expiresAt, now)}
          </span>
        </p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={restore}
          disabled={pending}
          aria-label={`Restaurar «${entry.title}»`}
        >
          {pending ? "Restaurando…" : "Restaurar"}
        </Button>
        <ConfirmDialog
          triggerLabel="Borrar para siempre"
          triggerAriaLabel={`Borrar para siempre «${entry.title}»`}
          title="¿Borrar para siempre?"
          description={`«${entry.title}» se borrará con sus imágenes y comentarios. No se puede deshacer.`}
          confirmLabel="Borrar para siempre"
          action={() => purgeFromTrash(entry.id)}
          onDone={() => {
            show(`«${entry.title}» borrado para siempre`);
            router.refresh();
          }}
        />
      </div>
    </li>
  );
}
