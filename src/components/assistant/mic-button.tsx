"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MicIcon } from "@/components/shell/icons";
import { Button } from "@/components/ui/button";
import {
  canDictate,
  DICTATION_ERRORS,
  startDictation,
  type Dictation,
} from "@/lib/speech/recognition";

// Spec 052 RF-13, RF-15, RNF-2: dictate to Venito. Tap to start and tap to
// stop, or hold and let go; the text goes into the field while it is said
// and is never sent by itself.

const NOTE_KEY = "cafam-mic-note";
/** Held longer than this, letting go stops listening. */
const HOLD_MS = 500;

export const MIC_NOTE =
  "Para pasar la voz a texto, algunos navegadores la envían a un servicio de su fabricante (Google en Chrome, Apple en Safari). CaFam no recibe el audio.";

const never = () => () => {};

function noteSeen(): boolean {
  try {
    return localStorage.getItem(NOTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function MicButton({
  disabled,
  onText,
  onError,
  onListening,
}: {
  disabled?: boolean;
  /** "Escuchando…" in the field while it listens (RF-13). */
  onListening?: (listening: boolean) => void;
  /** Everything heard so far, while it is said. */
  onText: (text: string) => void;
  onError: (text: string | undefined) => void;
}) {
  const supported = useSyncExternalStore(
    never,
    () => canDictate(),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState(false);
  const dictation = useRef<Dictation | null>(null);
  const pressed = useRef<{ at: number; started: boolean } | null>(null);

  useEffect(() => () => dictation.current?.stop(), []);
  if (!supported) return null;

  function start(): boolean {
    if (dictation.current) return false;
    // RF-15: the first time, say where the voice may go before listening.
    if (!noteSeen()) {
      setNote(true);
      return false;
    }
    onError(undefined);
    dictation.current = startDictation({
      onText,
      onError: (error) => onError(DICTATION_ERRORS[error]),
      onEnd: () => {
        dictation.current = null;
        setListening(false);
        onListening?.(false);
      },
    });
    setListening(dictation.current !== null);
    onListening?.(dictation.current !== null);
    return dictation.current !== null;
  }

  function stop() {
    dictation.current?.stop();
  }

  return (
    <div className="relative flex shrink-0 flex-col items-center">
      {note ? (
        <div
          role="dialog"
          aria-label="Dictado por voz"
          className="absolute bottom-12 left-0 z-10 flex w-72 flex-col gap-2 rounded-card surface-float p-3 text-sm text-ink"
        >
          <p>{MIC_NOTE}</p>
          <Button
            onClick={() => {
              try {
                localStorage.setItem(NOTE_KEY, "1");
              } catch {
                // Shown again next time: harmless.
              }
              setNote(false);
              start();
            }}
          >
            Entendido
          </Button>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={listening ? "Dejar de dictar" : "Dictar"}
        aria-pressed={listening}
        disabled={disabled}
        onPointerDown={() => {
          pressed.current = { at: Date.now(), started: start() };
        }}
        onPointerUp={() => {
          const press = pressed.current;
          if (press?.started && Date.now() - press.at > HOLD_MS) stop();
        }}
        onClick={() => {
          // The click after the press that started it does nothing more.
          const press = pressed.current;
          pressed.current = null;
          if (press?.started) return;
          if (listening) stop();
          else if (!press) start();
        }}
        className={`flex size-11 items-center justify-center rounded-full press-quiet focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60 ${listening ? "bg-accent text-on-accent" : "text-muted hover:bg-stone"}`}
      >
        <MicIcon />
      </button>
      {listening ? (
        <span role="status" className="sr-only">
          Escuchando…
        </span>
      ) : null}
    </div>
  );
}
