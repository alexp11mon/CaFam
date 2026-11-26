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
import { useLocale, useT } from "@/components/i18n/locale-provider";

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
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { show } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const kind = kindText(entry, t);

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreFromTrash(entry.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      show(t("«{title}» restaurado", { title: entry.title }));
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
          {formatEventWhen(entry, timeZone, locale)}
        </p>
        <p className="text-sm text-muted">
          {deletedText(entry, now, t)} ·{" "}
          <span className="tabular-nums">
            {remainingText(entry.expiresAt, now, t)}
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
          aria-label={t("Restaurar «{title}»", { title: entry.title })}
        >
          {pending ? t("Restaurando…") : t("Restaurar")}
        </Button>
        <ConfirmDialog
          triggerLabel={t("Borrar para siempre")}
          triggerAriaLabel={t("Borrar para siempre «{title}»", {
            title: entry.title,
          })}
          title={t("¿Borrar para siempre?")}
          description={t(
            "«{title}» se borrará con sus imágenes y comentarios. No se puede deshacer.",
            { title: entry.title },
          )}
          confirmLabel={t("Borrar para siempre")}
          action={() => purgeFromTrash(entry.id)}
          onDone={() => {
            show(t("«{title}» borrado para siempre", { title: entry.title }));
            router.refresh();
          }}
        />
      </div>
    </li>
  );
}
