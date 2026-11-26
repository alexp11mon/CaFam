"use client";

import { useId, useState } from "react";
import { CalendarIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { quickDates } from "@/lib/notes/due";
import { useT } from "@/components/i18n/locale-provider";

export interface ItemDue {
  dueDate: string | null;
  dueTime: string | null;
}

const FIELD =
  "min-h-11 rounded-control border border-control bg-paper px-3 text-base text-ink tabular-nums";

/**
 * The due date of an item from its menu (spec 048 RF-1): "Hoy", "Mañana",
 * "Próxima semana" or a date with an optional time.
 */
export function ItemDueMenu({
  text,
  dueDate,
  dueTime,
  today,
  onChange,
}: ItemDue & {
  text: string;
  today: string;
  onChange: (due: ItemDue) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dateId = useId();
  const timeId = useId();
  const [date, setDate] = useState(dueDate ?? "");
  const [time, setTime] = useState(dueTime ?? "");
  const quick = quickDates(today);

  function choose(due: ItemDue) {
    setOpen(false);
    onChange(due);
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <IconButton
        label={t("Fecha de «{text}»", { text })}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setDate(dueDate ?? "");
          setTime(dueTime ?? "");
          setOpen((now) => !now);
        }}
        className="text-muted"
      >
        <CalendarIcon />
      </IconButton>
      {open ? (
        <div
          id={panelId}
          role="group"
          aria-label={t("Fecha límite de «{text}»", { text })}
          className="pop absolute top-full right-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-card surface-float p-3"
        >
          <Button
            variant="secondary"
            onClick={() => choose({ dueDate: quick.today, dueTime: null })}
          >
            {t("Hoy")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => choose({ dueDate: quick.tomorrow, dueTime: null })}
          >
            {t("Mañana")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => choose({ dueDate: quick.nextWeek, dueTime: null })}
          >
            {t("Próxima semana")}
          </Button>
          <label htmlFor={dateId} className="text-sm font-medium text-ink">
            {t("Otra fecha")}
          </label>
          <input
            id={dateId}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={FIELD}
          />
          <label htmlFor={timeId} className="text-sm font-medium text-ink">
            {t("Hora (opcional)")}
          </label>
          <input
            id={timeId}
            type="time"
            value={time}
            disabled={!date}
            onChange={(event) => setTime(event.target.value)}
            className={FIELD}
          />
          <Button
            disabled={!date}
            onClick={() => choose({ dueDate: date, dueTime: time || null })}
          >
            {t("Guardar fecha")}
          </Button>
          {dueDate ? (
            <Button
              variant="quiet"
              onClick={() => choose({ dueDate: null, dueTime: null })}
            >
              {t("Quitar fecha")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
