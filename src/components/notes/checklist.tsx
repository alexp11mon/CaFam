"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, GripIcon, TrashIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ITEM_TEXT_MAX, ITEMS_MAX } from "@/lib/notes/limits";
import { moveItem, sortItems } from "@/lib/notes/order";
import { useItemDrag } from "./use-item-drag";
import { progress } from "@/lib/notes/progress";
import type { NoteItem } from "@/lib/notes/types";
import { dueLabel, isOverdue } from "@/lib/notes/due";
import { useNow } from "@/lib/hooks/use-now";
import { ItemDueMenu, type ItemDue } from "./item-due-menu";
import { useLocale, useT } from "@/components/i18n/locale-provider";

export interface ChecklistHandlers {
  onAdd: (text: string) => void;
  onToggle: (item: NoteItem) => void;
  onRename: (item: NoteItem, text: string) => void;
  /** Alt+↑/↓ on the handle (spec 048 RF-4). */
  onMove: (item: NoteItem, direction: "up" | "down") => void;
  /** Dropped at `toIndex` of the pending ones (spec 048 RF-3). */
  onPlace?: (item: NoteItem, toIndex: number) => void;
  onDelete: (item: NoteItem) => void;
  onClearDone: () => void;
  /** Spec 048 RF-1. */
  onDue?: (item: NoteItem, due: ItemDue) => void;
}

/**
 * The items of a list (spec 028 RF-6): add with Enter and keep adding, tick
 * (the item goes down with the done ones), rename in place, move with
 * buttons and delete. It only draws and asks: the note's editor owns the
 * items and saves them (plan D5).
 */
export function Checklist({
  items,
  canWrite,
  today,
  ...handlers
}: {
  items: NoteItem[];
  canWrite: boolean;
  /** YYYY-MM-DD in the profile's zone, for the due dates (spec 048 RF-2). */
  today?: string;
} & ChecklistHandlers) {
  const t = useT();
  const locale = useLocale();
  const now = useNow();
  // HH:MM on this device: an item due at an hour is late past it.
  const nowTime = now ? new Date(now).toTimeString().slice(0, 5) : "00:00";
  const [draft, setDraft] = useState("");
  const adder = useRef<HTMLInputElement>(null);
  // Never a fixed id: Activity keeps a hidden copy of the page in the DOM.
  const adderId = useId();
  const sorted = sortItems(items);
  const pending = sorted.filter((item) => !item.done);
  const done = sorted.filter((item) => item.done);
  const count = progress(items);
  const full = items.length >= ITEMS_MAX;
  const pendingList = useRef<HTMLUListElement>(null);
  const drag = useItemDrag(pendingList, (id, toIndex) => {
    const item = pending.find((other) => other.id === id);
    if (item) handlers.onPlace?.(item, toIndex);
  });

  function add() {
    const text = draft.trim();
    if (!text || full) return;
    handlers.onAdd(text);
    setDraft("");
    // The next one can be typed right away (RF-6).
    adder.current?.focus();
  }

  function onAdderKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      add();
    }
  }

  const lastPending = pending.at(-1)?.id;

  const row = (item: NoteItem) => {
    const movable = canWrite && !item.done;
    return (
      <li
        key={item.id}
        data-done={item.done || undefined}
        data-item-id={item.done ? undefined : item.id}
        data-dragging={drag.dragging === item.id || undefined}
        className={`row-in relative flex items-center gap-1 rounded-control border-y-2 py-0.5 pr-1 hover:bg-stone ${
          drag.dragging === item.id ? "bg-stone opacity-60" : ""
        } ${drag.over === item.id ? "border-t-accent" : "border-t-transparent"} ${
          drag.over === "end" && item.id === lastPending
            ? "border-b-accent"
            : "border-b-transparent"
        }`}
      >
        {movable ? (
          <button
            type="button"
            aria-label={t("Mover «{text}»", { text: item.text })}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            title={t("Arrastra o usa Alt+↑/↓")}
            onKeyDown={(event) => {
              if (!event.altKey) return;
              const direction =
                event.key === "ArrowUp"
                  ? "up"
                  : event.key === "ArrowDown"
                    ? "down"
                    : null;
              if (!direction || !moveItem(items, item.id, direction)) return;
              event.preventDefault();
              handlers.onMove(item, direction);
            }}
            {...drag.handle(item.id)}
            className="flex min-h-11 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-muted press-quiet focus-visible:outline-2 focus-visible:outline-ink active:cursor-grabbing"
          >
            <GripIcon />
          </button>
        ) : null}
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.text}
          disabled={!canWrite}
          onClick={() => handlers.onToggle(item)}
          className="group flex size-11 shrink-0 items-center justify-center rounded-full press-quiet focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed"
        >
          <span
            aria-hidden="true"
            data-checked={item.done || undefined}
            className={`check-pop flex size-5.5 items-center justify-center rounded-full border-[1.5px] transition-colors [&_svg]:size-3.5 ${item.done ? "border-accent bg-accent text-on-accent" : "border-control bg-paper text-transparent group-hover:border-accent"}`}
          >
            <CheckIcon />
          </span>
        </button>
        {/* The date goes under the text so it never squeezes it (390 px). */}
        <div className="flex min-w-0 flex-1 flex-col">
          {canWrite ? (
            <input
              aria-label={t("Texto de «{text}»", { text: item.text })}
              defaultValue={item.text}
              // A change that comes from outside replaces what is shown.
              key={item.text}
              maxLength={ITEM_TEXT_MAX}
              onBlur={(event) => {
                const text = event.target.value.trim();
                if (text && text !== item.text) handlers.onRename(item, text);
                else event.target.value = item.text;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className={`min-h-11 w-full min-w-0 rounded-block bg-transparent px-1 text-base outline-none focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-ink/20 ${item.done ? "text-muted line-through decoration-muted/70" : "text-ink"}`}
            />
          ) : (
            <span
              className={`min-w-0 px-1 py-2 ${item.done ? "text-muted line-through decoration-muted/70" : "text-ink"}`}
            >
              {item.text}
            </span>
          )}
          {today && item.dueDate ? (
            <span
              className={`-mt-2 px-1 pb-1 text-sm tabular-nums ${
                !item.done &&
                isOverdue(item.dueDate, item.dueTime, today, nowTime)
                  ? "font-semibold text-danger"
                  : "text-muted"
              }`}
            >
              <span className="sr-only">{t("Fecha límite:")} </span>
              {dueLabel(item.dueDate, item.dueTime, today, locale)}
            </span>
          ) : null}
        </div>
        {canWrite && today && handlers.onDue && !item.done ? (
          <ItemDueMenu
            text={item.text}
            dueDate={item.dueDate ?? null}
            dueTime={item.dueTime ?? null}
            today={today}
            onChange={(due) => handlers.onDue!(item, due)}
          />
        ) : null}
        {canWrite ? (
          <IconButton
            label={t("Borrar «{text}»", { text: item.text })}
            onClick={() => handlers.onDelete(item)}
            className="text-muted"
          >
            <TrashIcon />
          </IconButton>
        ) : null}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {canWrite ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={adderId}>
            {t("Añadir elemento")}
          </label>
          <input
            id={adderId}
            ref={adder}
            value={draft}
            maxLength={ITEM_TEXT_MAX}
            placeholder={
              full
                ? t("La lista está llena")
                : t("Añadir elemento y pulsar Intro")
            }
            disabled={full}
            enterKeyHint="done"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onAdderKey}
            className="min-h-12 min-w-0 flex-1 rounded-control border border-control bg-paper px-4 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
          />
          <Button onClick={add} disabled={!draft.trim() || full}>
            {t("Añadir")}
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-4 text-center text-muted">
          {canWrite
            ? t("La lista está vacía. Escribe el primer elemento arriba.")
            : t("La lista está vacía.")}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul
          ref={pendingList}
          aria-label={t("Pendientes")}
          className="flex flex-col"
        >
          {pending.map(row)}
        </ul>
      ) : null}

      {done.length > 0 ? (
        <section className="flex flex-col gap-1 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 className="text-sm font-semibold text-muted tabular-nums">
              {t("Completadas: {label}", { label: count.label })}
            </h2>
            {canWrite ? (
              <Button variant="quiet" onClick={handlers.onClearDone}>
                {t("Borrar los completados")}
              </Button>
            ) : null}
          </div>
          <ul aria-label={t("Completadas")} className="flex flex-col">
            {done.map(row)}
          </ul>
        </section>
      ) : items.length > 0 ? (
        <p className="text-sm font-semibold text-muted tabular-nums">
          {t("Completadas: {label}", { label: count.label })}
        </p>
      ) : null}
    </div>
  );
}
