"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  RECENT_ZONES_KEY,
  pushRecentZone,
  validZone,
  zoneCity,
  zoneOptions,
} from "@/lib/calendar/event-zone";

// "Zona horaria" of the full event form (spec 045 RF-1, RF-2, plan D3, D4):
// folded as "En tu zona (…)"; open, a searchable list of the IANA zones with
// their offset, the user's recent ones first. Sends startTz and endTz; empty
// while they are the profile's zone (RF-6).

function readRecent(): string[] {
  try {
    const list: unknown = JSON.parse(
      localStorage.getItem(RECENT_ZONES_KEY) ?? "[]",
    );
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function remember(zone: string) {
  try {
    localStorage.setItem(
      RECENT_ZONES_KEY,
      JSON.stringify(pushRecentZone(readRecent(), zone)),
    );
  } catch {
    // Private mode: the list just starts empty next time.
  }
}

const noop = () => () => {};

function ZoneInput({
  label,
  zone,
  onZone,
  listId,
}: {
  label: string;
  zone: string;
  onZone: (zone: string) => void;
  listId: string;
}) {
  const [text, setText] = useState(zone);
  const [error, setError] = useState<string>();
  return (
    <TextField
      label={label}
      name="zoneSearch"
      // Never sent: the hidden fields carry the zone.
      form="none"
      type="search"
      list={listId}
      autoComplete="off"
      placeholder="Busca una ciudad"
      value={text}
      error={error}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const valid = validZone(next);
        setError(undefined);
        if (valid) onZone(valid);
      }}
      onBlur={() => {
        if (!validZone(text)) {
          setError("Elige una zona de la lista.");
        } else {
          remember(text);
        }
      }}
    />
  );
}

export function TimeZoneField({
  profileZone,
  initialStart,
  initialEnd,
}: {
  profileZone: string;
  /** The event's own zones; empty = the profile's (RF-6). */
  initialStart: string;
  initialEnd: string;
}) {
  const listId = useId();
  const [start, setStart] = useState(initialStart || profileZone);
  const [end, setEnd] = useState(initialEnd || initialStart || profileZone);
  const [open, setOpen] = useState(Boolean(initialStart));
  const [split, setSplit] = useState(
    Boolean(initialEnd && initialEnd !== initialStart),
  );
  // Offsets depend on the moment and the recent list on this device.
  const options = useSyncExternalStore(
    noop,
    () => (open ? optionsNow() : null),
    () => null,
  );

  const endZone = split ? end : start;
  const own = start !== profileZone || endZone !== profileZone;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="startTz" value={own ? start : ""} />
      <input type="hidden" name="endTz" value={own ? endZone : ""} />
      {open ? (
        <>
          <ZoneInput
            label={split ? "Zona de inicio" : "Zona horaria"}
            zone={start}
            onZone={setStart}
            listId={listId}
          />
          {split ? (
            <ZoneInput
              label="Zona de fin"
              zone={end}
              onZone={setEnd}
              listId={listId}
            />
          ) : null}
          <datalist id={listId}>
            {options?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </datalist>
          <label className="flex min-h-11 items-center gap-3 text-ink">
            <input
              type="checkbox"
              checked={split}
              onChange={(event) => setSplit(event.target.checked)}
              className="size-5 accent-ink"
            />
            Inicio y fin en zonas distintas
          </label>
          <p className="text-sm text-muted">
            Las horas se leen en esta zona; cada persona lo verá en la suya.
          </p>
        </>
      ) : (
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
          <p className="text-ink">
            En tu zona{" "}
            <span className="text-muted">
              ({zoneCity(profileZone)}, {profileZone})
            </span>
          </p>
          <Button variant="quiet" onClick={() => setOpen(true)}>
            Cambiar zona horaria
          </Button>
        </div>
      )}
    </div>
  );
}

// One list per opening: computing 400 offsets on every render is wasteful.
let cached: { at: number; value: ReturnType<typeof zoneOptions> } | null = null;
function optionsNow() {
  const now = Date.now();
  if (!cached || now - cached.at > 60_000) {
    cached = { at: now, value: zoneOptions(now, readRecent()) };
  }
  return cached.value;
}
