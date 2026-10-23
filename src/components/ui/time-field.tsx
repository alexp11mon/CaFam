"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { normalizeTime, type TimeOption } from "@/lib/calendar/time-options";

/** Index of the option to start from: the value itself, or the first one after it. */
function activeIndexFor(options: TimeOption[], value: string): number {
  const exact = options.findIndex((option) => option.value === value);
  if (exact !== -1) return exact;
  const later = options.findIndex((option) => option.value > value);
  return later === -1 ? options.length - 1 : later;
}

/**
 * Typed hour with a list to pick from: the ARIA combobox pattern on a text
 * input (spec 008 RF-13..RF-16, RF-49, plan D5). Sends HH:MM under `name`;
 * an invalid text is left as typed so the server rejects it as before.
 */
export function TimeField({
  label,
  name,
  value,
  onValueChange,
  options,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: TimeOption[];
  error?: string;
}) {
  // useId, not the name: Next keeps the previous page hidden in the DOM (cacheComponents).
  const id = useId();
  const listId = `${id}-list`;
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  function show() {
    setActive(activeIndexFor(options, value));
    setOpen(true);
  }

  function pick(option: TimeOption) {
    onValueChange(option.value);
    setOpen(false);
  }

  function move(step: number) {
    const next = Math.min(Math.max(active + step, 0), options.length - 1);
    setActive(next);
    // jsdom has no scrollIntoView.
    list.current
      ?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${next}`)}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) show();
      else move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && open && options[active]) {
      // Picks the time instead of sending the form.
      event.preventDefault();
      pick(options[active]);
    } else if (event.key === "Escape" && open) {
      // Closes only the list: the window around it stays (RF-15).
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onFocus={show}
        onClick={() => {
          if (!open) show();
        }}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={() => {
          setOpen(false);
          const tidy = normalizeTime(value);
          if (tidy && tidy !== value) onValueChange(tidy);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-control bg-paper px-3 py-2 text-base text-ink tabular-nums outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20 aria-invalid:border-danger"
      />
      <ul
        ref={list}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="absolute top-full z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-line bg-paper py-1 shadow-lg"
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === active}
            // Keep the focus in the field while clicking.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(option)}
            className={`cursor-pointer px-3 py-2 text-base text-ink tabular-nums ${index === active ? "bg-stone font-semibold" : "hover:bg-stone"}`}
          >
            {option.label}
          </li>
        ))}
      </ul>
      {error ? (
        <p id={errorId} aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
