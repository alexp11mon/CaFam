"use client";

import { usePathname } from "next/navigation";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { loadAssistantContext } from "@/app/dashboard/assistant/context-actions";
import { Venito } from "@/components/brand/venito";
import { PHONE_QUERY } from "@/lib/hooks/use-is-phone";
import { activeSection } from "@/lib/shell/nav";

// The chat's own JS stays out of every screen's first load (spec 027 RNF-2).
const loadChat = () => import("@/components/assistant/assistant-chat");
const Chat = lazy(() =>
  loadChat().then((module) => ({ default: module.AssistantChat })),
);

type Activity = "idle" | "thinking" | "answered";

/** A swipe down on the chat's header this long closes it (spec 027 RF-2). */
const CLOSE_SWIPE_PX = 80;

/**
 * Venito, in the bottom right corner of every screen of the panel but the
 * assistant's own page (constitution, amendment 10; spec 027 RF-2, RF-3,
 * plan D1, D2). Its face opens the chat right there, with no navigation: a
 * modal <dialog> that fills a phone and floats by the corner from 769 px.
 * The chat is mounted on the first opening and stays, so the conversation
 * lives while the app is open, and only in memory.
 */
export function AssistantFab() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const warmed = useRef(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // The account is only asked for what the chat needs once it is opened.
  const [opened, setOpened] = useState(false);
  const [activity, setActivity] = useState<Activity>("idle");
  const onOwnPage = activeSection(pathname) === "assistant";

  // Fetched and mounted (closed) while nothing else is going on, so the
  // first opening only has to show it (spec 024 RF-19, spec 027 RNF-1).
  useEffect(() => {
    let gone = false;
    const load = () =>
      void loadChat().then(() => {
        if (!gone) setMounted(true);
      });
    if (typeof requestIdleCallback === "function") {
      const idle = requestIdleCallback(load, { timeout: 1500 });
      return () => {
        gone = true;
        cancelIdleCallback(idle);
      };
    }
    const timer = setTimeout(load, 1500);
    return () => {
      gone = true;
      clearTimeout(timer);
    };
  }, []);

  // On a phone the keyboard does not change dvh: the panel takes the height
  // that is really visible, so the input stays above the keyboard (plan D6).
  useEffect(() => {
    const panel = dialog.current;
    const viewport = window.visualViewport;
    if (!open || !panel || !viewport) return;
    const fit = () => {
      if (!window.matchMedia(PHONE_QUERY).matches) {
        panel.style.height = "";
        panel.style.translate = "";
        return;
      }
      panel.style.height = `${viewport.height}px`;
      panel.style.translate = `0 ${viewport.offsetTop}px`;
    };
    fit();
    viewport.addEventListener("resize", fit);
    viewport.addEventListener("scroll", fit);
    return () => {
      viewport.removeEventListener("resize", fit);
      viewport.removeEventListener("scroll", fit);
      panel.style.height = "";
      panel.style.translate = "";
    };
  }, [open]);

  // The finger is on the button: wake the assistant's function up now.
  const warm = () => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/assistant").catch(() => {});
  };

  function show() {
    setMounted(true);
    setOpened(true);
    setOpen(true);
    // Seen: the dot of a new answer goes.
    setActivity((current) => (current === "answered" ? "idle" : current));
    dialog.current?.showModal();
  }
  const close = () => dialog.current?.close();

  // Dragging the chat's header down closes it, as a sheet (RF-2).
  const drag = useRef<{ id: number; y: number } | null>(null);
  function onPointerDown(event: PointerEvent<HTMLDialogElement>) {
    const target = event.target as Element;
    if (!target.closest("[data-chat-header]") || target.closest("button"))
      return;
    drag.current = { id: event.pointerId, y: event.clientY };
  }
  function onPointerUp(event: PointerEvent<HTMLDialogElement>) {
    const start = drag.current;
    drag.current = null;
    if (
      start?.id === event.pointerId &&
      event.clientY - start.y > CLOSE_SWIPE_PX
    )
      close();
  }

  if (onOwnPage) return null;
  const mood =
    activity === "thinking"
      ? "thinking"
      : activity === "answered"
        ? "happy"
        : "idle";
  const note =
    activity === "thinking"
      ? ", está respondiendo"
      : activity === "answered"
        ? ", ha respondido"
        : "";

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`Venito, tu asistente${note}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={warm}
        onFocus={warm}
        onClick={show}
        className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-20 flex size-14 items-center justify-center rounded-full surface-float press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink max-tab:group-data-[has-dock]/frame:bottom-[calc(7.25rem+env(safe-area-inset-bottom)+0.75rem)] lg:right-6 lg:bottom-6"
      >
        <Venito mood={mood} className="size-12" />
        {activity === "idle" ? null : (
          <span
            aria-hidden="true"
            data-activity={activity}
            className="absolute top-0 right-0 size-3.5 rounded-full border-2 border-paper bg-accent"
          />
        )}
      </button>
      <dialog
        ref={dialog}
        aria-label="Chat con Venito"
        onClose={() => {
          setOpen(false);
          button.current?.focus();
        }}
        // The backdrop is the dialog itself: a tap outside closes it.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        className="m-0 h-dvh max-h-none w-full max-w-none origin-bottom-right overflow-hidden bg-paper p-0 text-ink backdrop:bg-scrim/50 tab:mt-auto tab:mr-6 tab:mb-6 tab:ml-auto tab:h-[min(42rem,calc(100dvh-3rem))] tab:w-[26rem] tab:rounded-card tab:surface-float tab:backdrop:bg-scrim/20"
      >
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] tab:pt-0">
          {mounted ? (
            <Suspense
              fallback={
                <p role="status" className="p-6 text-muted">
                  Venito se está asomando…
                </p>
              }
            >
              <Chat
                loadContext={opened ? loadAssistantContext : undefined}
                onClose={close}
                onActivity={(state) =>
                  // A reply that arrives with the chat on screen is seen.
                  setActivity(
                    state === "answered" && dialog.current?.open
                      ? "idle"
                      : state,
                  )
                }
              />
            </Suspense>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
