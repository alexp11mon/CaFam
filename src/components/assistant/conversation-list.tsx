"use client";

import { useState } from "react";
import type { ConversationItem } from "@/app/dashboard/assistant/conversation-actions";
import { TrashIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useT } from "@/components/i18n/locale-provider";

// Spec 052 RF-10: the saved conversations, newest first. Opening one goes on
// with it; each can be forgotten, or all at once.

const DAY = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ConversationList({
  items,
  onOpen,
  onDelete,
  onDeleteAll,
}: {
  /** Null while they load. */
  items: readonly ConversationItem[] | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  return (
    <section
      aria-labelledby="conversations-title"
      className="flex flex-col gap-2"
    >
      <h3 id="conversations-title" className="text-base font-semibold">
        {t("Conversaciones")}
      </h3>
      {items === null ? (
        <p className="text-sm text-muted">{t("Cargando…")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">
          {t("No hay conversaciones guardadas.")}
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-1 py-1">
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className="press-quiet flex min-h-11 min-w-0 flex-1 flex-col items-start rounded-control px-2 py-1 text-left focus-visible:outline-2 focus-visible:outline-ink"
                >
                  <span className="w-full truncate font-medium text-ink">
                    {item.title}
                  </span>
                  <span className="text-sm text-muted tabular-nums">
                    {DAY.format(new Date(item.updatedAt))}
                  </span>
                </button>
                <IconButton
                  label={t("Borrar «{title}»", { title: item.title })}
                  onClick={() => onDelete(item.id)}
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
          {confirming ? (
            <div className="flex flex-col gap-2 rounded-control border border-line p-3">
              <p className="text-sm">
                {t(
                  "¿Borrar todas las conversaciones guardadas? No se puede deshacer.",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirming(false);
                    onDeleteAll();
                  }}
                >
                  {t("Sí, borrar todas")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirming(false)}
                >
                  {t("Cancelar")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="quiet" onClick={() => setConfirming(true)}>
              {t("Borrar todas")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
