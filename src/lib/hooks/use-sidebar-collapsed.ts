"use client";

import { useSyncExternalStore } from "react";

const KEY = "cafam-sidebar";

/**
 * The calendar's side panel folded, remembered on this device (spec 019
 * RF-17, RF-21, plan D12), and the mini month opened by the title while
 * folded (RF-19). Module state: the toolbar and the workspace share it.
 */
let collapsed: boolean | null = null;
let pickerOpen = false;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  if (collapsed !== null) return collapsed;
  try {
    collapsed = localStorage.getItem(KEY) === "collapsed";
  } catch {
    // Blocked storage: unfolded.
    collapsed = false;
  }
  return collapsed;
}

function notify() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

/** `null` forgets the live value and reads the saved one again (tests). */
export function setSidebarCollapsed(value: boolean | null) {
  collapsed = value;
  if (value === false) pickerOpen = false;
  if (value !== null) {
    try {
      if (value) localStorage.setItem(KEY, "collapsed");
      else localStorage.removeItem(KEY);
    } catch {
      // Not remembered, still applied.
    }
  }
  notify();
}

export function setSidebarPicker(open: boolean) {
  pickerOpen = open;
  notify();
}

type Snapshot = { collapsed: boolean; pickerOpen: boolean };
let snapshot: Snapshot | null = null;
const SERVER: Snapshot = { collapsed: false, pickerOpen: false };

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  snapshot ??= { collapsed: readCollapsed(), pickerOpen };
  return snapshot;
}

export function useSidebar(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
