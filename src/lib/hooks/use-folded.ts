"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  FOLDED_KEY,
  isFolded,
  parseFolded,
  withChoice,
  type FoldChoices,
} from "@/lib/calendar/folded";

/**
 * Folded lists remembered on this device (spec 032 RF-6, plan D2). Module
 * state, like the side panel's (spec 019): the filters, the phone's sheet and
 * "Mis calendarios" share it, also an instance kept hidden by Activity.
 */
let choices: FoldChoices | null = null;
const listeners = new Set<() => void>();
const SERVER: FoldChoices = {};

function read(): FoldChoices {
  if (choices) return choices;
  try {
    choices = parseFolded(localStorage.getItem(FOLDED_KEY));
  } catch {
    // Blocked storage: everything takes its default.
    choices = {};
  }
  return choices;
}

/** Forgets the live value and reads the saved one again (tests). */
export function resetFolded() {
  choices = null;
  listeners.forEach((listener) => listener());
}

export function setFolded(id: string, folded: boolean) {
  choices = withChoice(read(), id, folded);
  try {
    localStorage.setItem(FOLDED_KEY, JSON.stringify(choices));
  } catch {
    // Not remembered, still applied.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether `id` is folded, and the function that folds or unfolds it. */
export function useFolded(
  id: string,
  byDefault = false,
): [boolean, (folded: boolean) => void] {
  const current = useSyncExternalStore(subscribe, read, () => SERVER);
  const set = useCallback((folded: boolean) => setFolded(id, folded), [id]);
  return [isFolded(current, id, byDefault), set];
}
