"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, ChevronIcon, TrashIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ITEM_TEXT_MAX, ITEMS_MAX } from "@/lib/notes/limits";
import { moveItem, sortItems } from "@/lib/notes/order";
import { progress } from "@/lib/notes/progress";
import type { NoteItem } from "@/lib/notes/types";

export interface ChecklistHandlers {
  onAdd: (text: string) => void;
  onToggle: (item: NoteItem) => void;
  onRename: (item: NoteItem, text: string) => void;
  onMove: (item: NoteItem, direction: "up" | "down") => void;
  onDelete: (item: NoteItem) => void;
  onClearDone: () => void;
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
  ...handlers
}: {
  items: NoteItem[];
  canWrite: boolean;
} & ChecklistHandlers) {
  const [draft, setDraft] = useState("");
  const adder = useRef<HTMLInputElement>(null);
  // Never a fixed id: Activity keeps a hidden copy of the page in the DOM.
  const adderId = useId();
  const sorted = sortItems(items);
  const pending = sorted.filter((item) => !item.done);
  const done = sorted.filter((item) => item.done);
  const count = progress(items);
  const full = items.length >= ITEMS_MAX;

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

  const row = (item: NoteItem) => {
    const movable = canWrite && !item.done;
    return (
      <li
        key={item.id}
        data-done={item.done || undefined}
        className="row-in flex items-center gap-1 rounded-control py-0.5 pr-1 hover:bg-stone"
      >
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
        {canWrite ? (
          <input
            aria-label={`Texto de «${item.text}»`}
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
            className={`min-h-11 min-w-0 flex-1 rounded-block bg-transparent px-1 text-base outline-none focus-visible:bg-paper focus-visible:ring-2 focus-visible:ring-ink/20 ${item.done ? "text-muted line-through decoration-muted/70" : "text-ink"}`}
          />
        ) : (
          <span
            className={`min-w-0 flex-1 px-1 py-2 ${item.done ? "text-muted line-through decoration-muted/70" : "text-ink"}`}
          >
            {item.text}
          </span>
        )}
        {movable ? (
          <>
            <IconButton
              label={`Subir «${item.text}»`}
              disabled={moveItem(items, item.id, "up") === null}
              onClick={() => handlers.onMove(item, "up")}
              className="disabled:opacity-30"
            >
              <ChevronIcon direction="up" />
            </IconButton>
            <IconButton
              label={`Bajar «${item.text}»`}
              disabled={moveItem(items, item.id, "down") === null}
              onClick={() => handlers.onMove(item, "down")}
              className="disabled:opacity-30"
            >
              <ChevronIcon direction="down" />
            </IconButton>
          </>
        ) : null}
        {canWrite ? (
          <IconButton
            label={`Borrar «${item.text}»`}
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
            Añadir elemento
          </label>
          <input
            id={adderId}
            ref={adder}
            value={draft}
            maxLength={ITEM_TEXT_MAX}
            placeholder={
              full ? "La lista está llena" : "Añadir elemento y pulsar Intro"
            }
            disabled={full}
            enterKeyHint="done"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onAdderKey}
            className="min-h-12 min-w-0 flex-1 rounded-control border border-control bg-paper px-4 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
          />
          <Button onClick={add} disabled={!draft.trim() || full}>
            Añadir
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-4 text-center text-muted">
          {canWrite
            ? "La lista está vacía. Escribe el primer elemento arriba."
            : "La lista está vacía."}
        </p>
      ) : null}

      {pending.length > 0 ? (
        <ul aria-label="Pendientes" className="flex flex-col">
          {pending.map(row)}
        </ul>
      ) : null}

      {done.length > 0 ? (
        <section className="flex flex-col gap-1 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 className="text-sm font-semibold text-muted tabular-nums">
              Completadas: {count.label}
            </h2>
            {canWrite ? (
              <Button variant="quiet" onClick={handlers.onClearDone}>
                Borrar los completados
              </Button>
            ) : null}
          </div>
          <ul aria-label="Completadas" className="flex flex-col">
            {done.map(row)}
          </ul>
        </section>
      ) : items.length > 0 ? (
        <p className="text-sm font-semibold text-muted tabular-nums">
          Completadas: {count.label}
        </p>
      ) : null}
    </div>
  );
}
