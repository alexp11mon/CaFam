"use client";

import { useId } from "react";
import { Avatar } from "@/components/people/avatar";
import { assignTints } from "@/lib/people/avatar";

// The people whose busy times the grid shows (spec 020 RF-5, RF-6, RF-17).

/** Eight people at a time, as grid_busy (plan D5). */
export const MAX_BUSY_PEOPLE = 8;

export interface BusyPersonOption {
  id: string;
  name: string;
  shown: boolean;
}

export function AvailabilityFilter({
  people,
  tints,
  onToggle,
}: {
  people: readonly BusyPersonOption[];
  /** The tint of each person, the same as in the blocks (RF-9). */
  tints?: ReadonlyMap<string, string>;
  onToggle: (personId: string, shown: boolean) => void;
}) {
  const headingId = useId();
  const noteId = useId();
  if (people.length === 0) return null;
  const colors = tints ?? assignTints(people.map((p) => p.id));
  const full = people.filter((p) => p.shown).length >= MAX_BUSY_PEOPLE;

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-3xl glass p-3"
    >
      <h2 id={headingId} className="text-base font-semibold text-ink">
        Disponibilidad
      </h2>
      <ul className="flex flex-col">
        {people.map((p) => (
          <li key={p.id}>
            <label className="press-quiet flex min-h-11 min-w-0 items-center gap-2 font-semibold text-ink has-disabled:text-muted">
              <input
                type="checkbox"
                checked={p.shown}
                disabled={full && !p.shown}
                aria-describedby={full && !p.shown ? noteId : undefined}
                onChange={() => onToggle(p.id, !p.shown)}
                className="size-5 shrink-0 accent-ink"
              />
              <Avatar name={p.name} tint={colors.get(p.id) ?? ""} />
              <span className="min-w-0 break-words">{p.name}</span>
            </label>
          </li>
        ))}
      </ul>
      {full ? (
        <p id={noteId} className="text-sm text-muted">
          Como mucho 8 personas a la vez
        </p>
      ) : null}
    </section>
  );
}
