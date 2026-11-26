"use client";

import { useId, type ReactNode } from "react";
import { FoldChevron } from "@/components/ui/fold-chevron";
import { IconButton } from "@/components/ui/icon-button";
import { useFolded } from "@/lib/hooks/use-folded";
import { useT } from "@/components/i18n/locale-provider";

/** A titled list of "Mis calendarios" that folds, remembered here (spec 032 RF-10). */
export function FoldSection({
  id,
  title,
  count,
  children,
}: {
  /** The id shared with the filters (`foldId`). */
  id: string;
  title: string;
  count: number;
  children: ReactNode;
}) {
  const t = useT();
  const headingId = useId();
  const listId = useId();
  const [folded, setFolded] = useFolded(id);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <IconButton
          label={t(folded ? "Desplegar {title}" : "Plegar {title}", { title })}
          aria-expanded={!folded}
          aria-controls={listId}
          onClick={() => setFolded(!folded)}
          className="-ml-2 text-muted"
        >
          <FoldChevron open={!folded} />
        </IconButton>
        <h2 id={headingId} className="text-lg font-semibold text-ink">
          {t(title)}
        </h2>
        <span className="text-sm text-muted tabular-nums">
          {count === 1 ? "1 calendario" : `${count} calendarios`}
        </span>
      </div>
      <div id={listId} hidden={folded}>
        {children}
      </div>
    </section>
  );
}
