"use client";

import { useEffect, useSyncExternalStore } from "react";

// The routes of the offline app and its navigation without the network
// (spec 034 RF-8, RF-16, RF-17, plan D16): links to them change the address
// with pushState; anything else says it needs a connection.

export type OfflineRoute =
  | { kind: "calendar" }
  | { kind: "event"; id: string }
  | { kind: "newEvent" }
  | { kind: "notes" }
  | { kind: "newNote" }
  | { kind: "note"; id: string }
  | { kind: "search" }
  | { kind: "needsNetwork" };

/** What the offline app shows for an address; null outside the panel. */
export function matchRoute(pathname: string): OfflineRoute | null {
  if (pathname === "/dashboard" || pathname === "/dashboard/calendar") {
    return { kind: "calendar" };
  }
  if (pathname === "/dashboard/events/new") return { kind: "newEvent" };
  if (pathname === "/dashboard/notes") return { kind: "notes" };
  if (pathname === "/dashboard/notes/new") return { kind: "newNote" };
  if (pathname === "/dashboard/search") return { kind: "search" };
  const event = /^\/dashboard\/events\/([^/]+)$/.exec(pathname);
  if (event) return { kind: "event", id: decodeURIComponent(event[1]!) };
  const note = /^\/dashboard\/notes\/([^/]+)$/.exec(pathname);
  if (note) return { kind: "note", id: decodeURIComponent(note[1]!) };
  if (pathname.startsWith("/dashboard/")) return { kind: "needsNetwork" };
  return null;
}

/** The `from` of /offline?from=…, only a path of the panel (never another site). */
export function safeFrom(search: string): string {
  const from = new URLSearchParams(search).get("from") ?? "";
  return /^\/dashboard(\/|\?|$)/.test(from) && !from.startsWith("//")
    ? from
    : "/dashboard/calendar";
}

const CHANGE = "cafam-offline-navigate";

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(CHANGE, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(CHANGE, listener);
  };
}

const current = () => window.location.pathname + window.location.search;

/** The address shown, which decides the screen. */
export function useOfflineLocation(): string {
  return useSyncExternalStore(subscribe, current, () => "/offline");
}

/** Another screen of the offline app, with no load. */
export function navigateOffline(href: string, replace = false) {
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(CHANGE));
  window.scrollTo?.(0, 0);
}

/**
 * The address of a plain click on a link of this site's panel, or null. It is
 * read in the capture phase, before React and Next's Link.
 */
export function panelLinkOf(event: MouseEvent): string | null {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") {
    return null;
  }
  const url = new URL(link.href);
  if (url.origin !== window.location.origin || !matchRoute(url.pathname)) {
    return null;
  }
  return url.pathname + url.search;
}

/**
 * Calls `go` instead of the link's own navigation while `active`, except for
 * the links `keep` leaves alone.
 */
export function useLinkCapture(
  active: boolean,
  go: (href: string) => void,
  keep?: (href: string) => boolean,
) {
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      const href = panelLinkOf(event);
      if (!href || keep?.(href)) return;
      event.preventDefault();
      event.stopPropagation();
      go(href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, go, keep]);
}

const onCalendar = (href: string) =>
  matchRoute(new URL(href, "http://local").pathname)?.kind === "calendar";
const withinCalendar = (href: string) =>
  onCalendar(href) && onCalendar(current());

/**
 * Turns clicks on links of the panel into offline navigation. Within the
 * calendar its own links stay: CalendarClient moves without the network
 * (spec 024) and keeps its view and date.
 */
export function OfflineRouter() {
  useLinkCapture(true, navigateOffline, withinCalendar);
  return null;
}
