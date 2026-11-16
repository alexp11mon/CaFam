"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NOTE_BODY_MAX } from "@/lib/notes/limits";

/** How long after the last key the text is saved. */
export const AUTOSAVE_MS = 800;

/**
 * A text note that saves itself (spec 028 RF-7): a while after the last key
 * and when the field is left, and it says so.
 */
export function TextNote({
  body,
  canWrite,
  onSave,
}: {
  body: string;
  canWrite: boolean;
  /** Resolves true when it was saved. */
  onSave: (body: string) => Promise<boolean>;
}) {
  const fieldId = useId();
  const [text, setText] = useState(body);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle",
  );
  const saved = useRef(body);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(text);

  // A change from outside (another device) while nothing is unsaved.
  const [seen, setSeen] = useState(body);
  if (seen !== body) {
    setSeen(body);
    if (text === seen) setText(body);
  }
  useEffect(() => {
    latest.current = text;
  });
  useEffect(() => {
    saved.current = body;
  }, [body]);

  async function save() {
    clearTimeout(timer.current);
    const value = latest.current;
    if (value === saved.current) return;
    setState("saving");
    const ok = await onSave(value);
    if (ok) saved.current = value;
    setState(ok ? "saved" : "failed");
  }
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  // What was typed is not lost when the note is left.
  useEffect(() => () => void saveRef.current(), []);

  if (!canWrite) {
    return (
      <p className="min-h-40 whitespace-pre-line text-ink">
        {body || <span className="text-muted">Nota vacía.</span>}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="sr-only">
        Texto de la nota
      </label>
      <textarea
        id={fieldId}
        value={text}
        maxLength={NOTE_BODY_MAX}
        rows={12}
        placeholder="Escribe aquí…"
        onChange={(event) => {
          setText(event.target.value);
          latest.current = event.target.value;
          setState("idle");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
        }}
        onBlur={() => void save()}
        className="min-h-60 w-full resize-y rounded-control border border-control bg-paper px-4 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20"
      />
      <p role="status" className="min-h-5 text-sm text-muted">
        {state === "saving"
          ? "Guardando…"
          : state === "saved"
            ? "Guardado"
            : state === "failed"
              ? "No se ha podido guardar"
              : ""}
      </p>
    </div>
  );
}
