"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { canDictate } from "@/lib/speech/recognition";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech/synthesis";

// Spec 052 RF-14, plan D5: "Leer respuestas en voz alta", off by default and
// remembered on this device, because it depends on where and when.

const KEY = "cafam-speak";
const listeners = new Set<() => void>();

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** `null` forgets the saved value (tests). */
export function setSpeakAnswers(on: boolean | null) {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered: it still applies until the page goes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const never = () => () => {};

/** RF-13, RF-15: whether the browser can listen or speak at all. */
export function useSpeechSupport(): { dictate: boolean; speak: boolean } {
  const dictate = useSyncExternalStore(
    never,
    () => canDictate(),
    () => false,
  );
  const speakable = useSyncExternalStore(
    never,
    () => canSpeak(),
    () => false,
  );
  return { dictate, speak: speakable };
}

export function useSpeakAnswers() {
  const supported = useSpeechSupport().speak;
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const [speaking, setSpeaking] = useState(false);

  const say = useCallback(
    (text: string) => {
      if (!supported || !on) return;
      if (speak(text, () => setSpeaking(false))) setSpeaking(true);
    },
    [supported, on],
  );
  const stop = useCallback(() => {
    stopSpeaking();
    setSpeaking(false);
  }, []);
  const setOn = useCallback(
    (next: boolean) => {
      if (!next) stop();
      setSpeakAnswers(next);
    },
    [stop],
  );

  return { supported, on: supported && on, setOn, speaking, say, stop };
}
