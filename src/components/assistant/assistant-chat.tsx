"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Venito } from "@/components/brand/venito";
import { CloseIcon, NewChatIcon, SendIcon } from "@/components/shell/icons";
import {
  NETWORK_TEXT,
  QUESTION_MESSAGES,
  UNAVAILABLE_TEXT,
} from "@/lib/assistant/error-messages";
import { checkAttachments } from "@/lib/assistant/attachments";
import { MAX_MESSAGES, QUESTION_MAX } from "@/lib/assistant/limits";
import type { Proposal } from "@/lib/assistant/proposal";
import {
  NDJSON,
  readLines,
  STATUS,
  type StreamLine,
} from "@/lib/assistant/stream";
import type { CitedEvent } from "@/lib/assistant/tools";
import {
  suggestionsFor,
  suggestionText,
  type Suggestion,
} from "@/lib/assistant/suggestions";
import { prepareForAssistant } from "@/lib/images/prepare-image";
import {
  dropShared,
  imagesOf,
  readShared,
  sharedIdFromLocation,
} from "@/lib/share/inbox";
import { describeAction, type AssistantAction } from "@/lib/assistant/actions";
import { isNo, isYes } from "@/lib/assistant/write-intent";
import { ActionCard, runCardStep, type ChatAction } from "./action-card";
import { useStackCards } from "./stack-cards";
import { CitedEvents } from "./cited-events";
import {
  AttachNote,
  AttachPreview,
  ImageAttach,
  type Attachment,
} from "./image-attach";
import { ProposalCard } from "./proposal-card";

// The chat of the assistant (spec 015 plan assistant-ui). The thread lives
// only in this component: leaving the page or "Nueva conversación" forgets it
// (RF-6).

interface Message {
  role: "user" | "assistant";
  content: string;
  /** When it was sent or arrived, for the hour under it (spec 027 RF-4). */
  at?: number;
  events?: CitedEvent[];
  /** Spec 022 RF-11: the images sent with this message, as data URLs. */
  images?: string[];
  proposal?: ChatProposal;
  /** Spec 036: what Venito created or proposes in this answer. */
  actions?: ChatAction[];
}

/** Spec 022: a proposal in the thread; only the last pending one is live. */
export interface ChatProposal extends Proposal {
  status: "pending" | "superseded" | "created";
  /** RF-45: what "Crear" has already written, for the links. */
  created?: { id: string; title: string }[];
}

/** Spec 022: calendars the proposal may use, for its selector (RF-26). */
export interface ChatCalendar {
  id: string;
  name: string;
}

/** When a message was sent or arrived; only ever called from handlers. */
const clock = () => Date.now();

/** Spec 036: a fresh card for an action that just arrived. */
const cardOf = (action: AssistantAction): ChatAction => ({
  action,
  status: action.kind === "change" ? "pending" : "done",
});

const pendingChange = (card: ChatAction) =>
  card.action.kind === "change" &&
  (card.status === "pending" || card.status === "failed");

/** Plan D10: the cards travel inside Venito's words, one line each. */
function threadContent(message: Message, timeZone: string): string {
  if (message.role !== "assistant" || !message.actions?.length) {
    return message.content;
  }
  return [
    message.content,
    ...message.actions.map((card) =>
      describeAction(card.action, timeZone, card.status),
    ),
  ].join("\n");
}

/** What the chat needs from the account, read after it is on screen. */
export interface ChatContext {
  timeZone: string;
  calendars: readonly ChatCalendar[];
}

export function AssistantChat({
  timeZone: givenTimeZone,
  calendars: givenCalendars,
  loadContext,
  onClose,
  onActivity,
  onChanged,
}: {
  /** Spec 036 RF-38: Venito wrote something; the calendar must refresh. */
  onChanged?: () => void;
  /** In the panel: its "Cerrar" (spec 027 RF-2). The full page has none. */
  onClose?: () => void;
  /** Tells the button of Venito that an answer is on its way, or has come. */
  onActivity?: (state: "thinking" | "answered" | "idle") => void;
  timeZone?: string;
  calendars?: readonly ChatCalendar[];
  /**
   * Reads the zone and the writable calendars once the chat is painted, so
   * opening it waits for nothing (spec 024 RF-19).
   */
  loadContext?: () => Promise<ChatContext>;
}) {
  const [loaded, setLoaded] = useState<ChatContext | null>(null);
  useEffect(() => {
    if (!loadContext) return;
    let gone = false;
    void loadContext()
      .then((context) => {
        if (!gone) setLoaded(context);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [loadContext]);
  // Until it arrives, the device's zone: the same for almost everyone.
  const timeZone =
    givenTimeZone ??
    loaded?.timeZone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const calendars = givenCalendars ?? loaded?.calendars ?? [];
  const [messages, setMessages] = useState<Message[]>([]);
  useStackCards(messages, onChanged);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachErrors, setAttachErrors] = useState<string[]>([]);
  // Plan D2: images re-sent while the assistant asks before proposing.
  const carried = useRef<string[]>([]);
  const preparing = useRef(0);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<{ text: string; retry: boolean }>();
  const [pending, setPending] = useState(false);
  // What the assistant is doing, as the server tells it (spec 024 RF-17).
  const [status, setStatus] = useState<string>(STATUS.start);
  const [quotaReached, setQuotaReached] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  // The file input, opened by its button and by a suggestion (spec 027 RF-5).
  const picker = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // R6: nobody reads the answer of a question asked from a page that is gone.
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  /** Spec 022 RF-4 to RF-9: checked, then reduced on the device. */
  async function addFiles(files: File[]) {
    const { accepted, errors } = checkAttachments(
      attachments.length + preparing.current,
      files,
    );
    setAttachErrors(errors);
    preparing.current += accepted.length;
    for (const file of accepted) {
      const result = await prepareForAssistant(file);
      preparing.current -= 1;
      if ("error" in result) {
        setAttachErrors((current) => [
          ...current,
          `${file.name}: ${result.error}`,
        ]);
      } else {
        setAttachments((current) => [
          ...current,
          { id: crypto.randomUUID(), url: result.dataUrl },
        ]);
      }
    }
  }

  // Images shared from another app arrive attached on the chat's own page
  // (spec 047 RF-7); they are sent only with a question.
  useEffect(() => {
    if (onClose) return;
    const id = sharedIdFromLocation();
    if (!id) return;
    window.history.replaceState(window.history.state, "", location.pathname);
    void readShared(id).then((item) => {
      if (!item) return;
      void dropShared(id);
      void addFiles(imagesOf(item));
    });
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    // RF-3: a pasted image is attached; pasted text stays text.
    const files = [...event.clipboardData.files].filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;
    event.preventDefault();
    void addFiles(files);
  }

  async function send(text: string) {
    if (pending || quotaReached) return;
    const question = text.trim();
    const attached = attachments;
    const images = attached.length
      ? attached.map((attachment) => attachment.url)
      : carried.current;
    // RF-3, the same rules as the server; spec 022 RF-12: images need no text.
    if (
      (!question && attached.length === 0) ||
      question.length > QUESTION_MAX
    ) {
      setFieldError(
        question ? QUESTION_MESSAGES.tooLong : QUESTION_MESSAGES.empty,
      );
      field.current?.focus();
      return;
    }
    const asked: Message = {
      role: "user",
      content: question,
      at: clock(),
      ...(attached.length ? { images } : {}),
    };
    // Spec 036 D5: a plain "sí" or "no" to a pending change needs no Venito.
    const waiting = messages.flatMap((message) =>
      (message.actions ?? []).filter(pendingChange),
    );
    if (
      waiting.length > 0 &&
      attached.length === 0 &&
      (isYes(question) || isNo(question))
    ) {
      await answerPending(asked, isYes(question) ? "confirm" : "cancel", text);
      return;
    }
    // Plan D2: images travel only with the last message.
    const thread = [
      ...messages.map((message) => ({
        role: message.role,
        content: threadContent(message, timeZone),
      })),
      { role: "user", content: question, ...(images.length ? { images } : {}) },
    ].slice(-MAX_MESSAGES);
    // RF-33: a correction carries the proposal as the user left it.
    const live = messages.findLast(
      (message) => message.proposal?.status === "pending",
    )?.proposal;
    setFieldError(undefined);
    setError(undefined);
    setAttachErrors([]);
    setMessages((current) => [...current, asked]);
    setDraft("");
    setAttachments([]);
    setStatus(STATUS.start);
    setPending(true);
    onActivity?.("thinking");
    let answered = false;
    // Spec 036 D12: cards that arrived before the answer, kept on cancel.
    const arrived: ChatAction[] = [];
    const abort = new AbortController();
    controller.current = abort;

    // On failure or cancel the question and its images go back (RF-4, RF-28;
    // spec 022 RF-54, RF-55).
    const giveBack = () => {
      if (arrived.length > 0) {
        // RF-44: part of it is done: say so instead of giving it back.
        answered = true;
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: "He parado. Esto ya estaba hecho:",
            at: clock(),
            actions: arrived,
          },
        ]);
        if (arrived.some((card) => card.action.kind === "created")) {
          onChanged?.();
        }
        return;
      }
      setMessages((current) => current.filter((message) => message !== asked));
      setDraft(text);
      setAttachments(attached);
    };
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: thread,
          ...(live ? { proposal: live.rows } : {}),
        }),
        signal: abort.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        giveBack();
        // RF-27: the quota is over until tomorrow, retrying would not help.
        if (response.status === 429) setQuotaReached(true);
        setError({
          text: failure.error ?? UNAVAILABLE_TEXT,
          retry: response.status === 503,
        });
        return;
      }
      // Spec 024 RF-16, RF-17: lines of progress, then the answer.
      let body: Extract<StreamLine, { type: "done" }> | null = null;
      let failed: Extract<StreamLine, { type: "error" }> | null = null;
      if (!response.headers.get("Content-Type")?.includes(NDJSON)) {
        // Something on the way joined the stream into one JSON answer.
        const whole = await response.json().catch(() => null);
        if (whole?.answer) body = { type: "done", ...whole };
      } else if (response.body) {
        for await (const line of readLines(response.body)) {
          if (line.type === "status") setStatus(line.text);
          else if (line.type === "action") arrived.push(cardOf(line.action));
          else if (line.type === "done") body = line;
          else if (line.type === "error") failed = line;
        }
      }
      if (!body) {
        giveBack();
        if (abort.signal.aborted) return;
        setError({
          text: failed?.text ?? UNAVAILABLE_TEXT,
          retry: failed?.retry ?? true,
        });
        return;
      }
      answered = true;
      const proposal: Proposal | undefined = body.proposal;
      const cards = (body.actions ?? arrived.map((card) => card.action)).map(
        cardOf,
      );
      const newChange = cards.some((card) => card.action.kind === "change");
      // Plan D2: the assistant asked something before proposing.
      carried.current = !proposal && images.length ? images : [];
      setMessages((current) => [
        // RF-34: a new proposal replaces the pending one.
        ...current.map((message) => {
          const replaced =
            proposal && message.proposal?.status === "pending"
              ? {
                  ...message,
                  proposal: {
                    ...message.proposal,
                    status: "superseded" as const,
                  },
                }
              : message;
          // Spec 036 RF-24b, RF-24c: a pending change is replaced by a new
          // one, or dropped when the user asked something else.
          return replaced.actions?.some(pendingChange)
            ? {
                ...replaced,
                actions: replaced.actions.map((card) =>
                  pendingChange(card)
                    ? {
                        ...card,
                        status: newChange
                          ? ("superseded" as const)
                          : ("cancelled" as const),
                        error: undefined,
                      }
                    : card,
                ),
              }
            : replaced;
        }),
        {
          role: "assistant",
          content: body.answer,
          at: clock(),
          events: body.events,
          ...(proposal
            ? { proposal: { ...proposal, status: "pending" as const } }
            : {}),
          ...(cards.length ? { actions: cards } : {}),
        },
      ]);
      if (cards.some((card) => card.action.kind === "created")) onChanged?.();
    } catch {
      giveBack();
      if (!abort.signal.aborted) setError({ text: NETWORK_TEXT, retry: true });
    } finally {
      if (controller.current === abort) controller.current = null;
      setPending(false);
      onActivity?.(answered ? "answered" : "idle");
      field.current?.focus();
    }
  }

  /** Spec 036 D5: "sí" confirms and "no" cancels the pending changes. */
  async function answerPending(
    asked: Message,
    step: "confirm" | "cancel",
    text: string,
  ) {
    setFieldError(undefined);
    setError(undefined);
    setDraft("");
    setMessages((current) => [...current, asked]);
    const steps: Promise<{ index: number; key: string; card: ChatAction }>[] =
      [];
    messages.forEach((message, index) => {
      for (const card of message.actions ?? []) {
        if (pendingChange(card)) {
          steps.push(
            runCardStep(card, step)
              .catch(() => ({ ...card, error: NETWORK_TEXT }))
              .then((next) => ({ index, key: card.action.key, card: next })),
          );
        }
      }
    });
    setPending(true);
    try {
      const done = await Promise.all(steps);
      const applied = done.filter(
        ({ card }) => card.status === "applied",
      ).length;
      const failed = done.find(({ card }) => card.error)?.card.error;
      setMessages((current) => [
        ...current.map((message, index) => {
          const mine = done.filter((step) => step.index === index);
          return mine.length && message.actions
            ? {
                ...message,
                actions: message.actions.map(
                  (card) =>
                    mine.find((step) => step.key === card.action.key)?.card ??
                    card,
                ),
              }
            : message;
        }),
        {
          role: "assistant",
          content:
            step === "cancel"
              ? "Vale, no lo cambio."
              : failed
                ? `No he podido aplicar el cambio: ${failed}`
                : applied > 1
                  ? "Hecho: he aplicado los cambios."
                  : "Hecho: he aplicado el cambio.",
          at: clock(),
        },
      ]);
      if (applied > 0) onChanged?.();
    } catch {
      setDraft(text);
    } finally {
      setPending(false);
      field.current?.focus();
    }
  }

  function restart() {
    controller.current?.abort();
    // RF-56: the pending proposal is dropped without creating anything.
    setMessages([]);
    setAttachments([]);
    setAttachErrors([]);
    carried.current = [];
    setDraft("");
    setError(undefined);
    setFieldError(undefined);
    field.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a new line (plan assistant-ui).
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void send(draft);
    }
  }

  const hour = (at: number | undefined) =>
    at === undefined
      ? null
      : new Intl.DateTimeFormat("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
        }).format(at);
  const empty = messages.length === 0 && !pending;
  const chips = suggestionsFor({
    messages: messages.length,
    attachments: attachments.length,
  });

  function pick(suggestion: Suggestion) {
    if (suggestion.kind === "attach") {
      picker.current?.click();
    } else if (suggestion.kind === "fill") {
      // What needs a name or a date: written, with the cursor after it.
      const text = suggestionText(suggestion);
      setDraft(text);
      setFieldError(undefined);
      const input = field.current;
      if (input) {
        input.focus();
        requestAnimationFrame(() =>
          input.setSelectionRange(text.length, text.length),
        );
      }
    } else {
      void send(suggestionText(suggestion));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Who you are talking to, as in any chat (spec 027 RF-4). */}
      <header
        data-chat-header=""
        className="flex items-center gap-3 border-b border-line bg-paper py-2 pr-2 pl-4"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-stone">
          <Venito
            mood={quotaReached ? "sleeping" : pending ? "thinking" : "idle"}
            className="size-10"
            compact
          />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base leading-tight font-semibold text-ink">
            Venito
          </h1>
          <p className="truncate text-sm text-muted">
            {quotaReached
              ? "descansando hasta mañana"
              : pending
                ? "escribiendo…"
                : "en línea"}
          </p>
        </div>
        <IconButton label="Nueva conversación" onClick={restart}>
          <NewChatIcon />
        </IconButton>
        {onClose ? (
          <IconButton label="Cerrar el chat" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        ) : null}
      </header>

      <div className="bg-chat flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-4">
        {empty ? (
          <section className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-card surface px-5 py-6 text-center">
            <Venito mood="wave" className="size-24" />
            <p className="text-lg font-semibold text-ink">¡Hola! Soy Venito</p>
            {/* RF-33 of spec 015: say where the data goes before the first question. */}
            <p className="text-sm text-muted">
              Pregúntame por tus eventos o por cuándo estáis libres, o pídeme
              que cree o cambie uno. Tus preguntas y los eventos necesarios para
              responderlas se envían a Groq, que no los usa para entrenar. Más
              detalles en la{" "}
              <Link
                href="/privacy"
                className="font-semibold text-ink underline decoration-control underline-offset-4"
              >
                política de privacidad
              </Link>
              .
            </p>
          </section>
        ) : null}

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversación"
          className="flex flex-col gap-3"
        >
          {messages.map((message, index) =>
            message.role === "user" ? (
              <div
                key={index}
                className="flex max-w-[85%] flex-col items-end gap-1 self-end"
              >
                <p className="rounded-card rounded-br-block border border-accent-edge bg-accent px-4 py-2 whitespace-pre-line text-on-accent">
                  <span className="sr-only">Tú: </span>
                  {message.content}
                  {message.images?.length ? (
                    <span className="mt-2 flex flex-wrap justify-end gap-2">
                      {message.images.map((url, i) => (
                        // A data URL kept in memory (RF-13): next/image would not help.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt={`Imagen adjunta ${i + 1}`}
                          className="size-20 rounded-control object-cover"
                        />
                      ))}
                    </span>
                  ) : null}
                </p>
                <time className="px-1 text-xs text-muted tabular-nums">
                  {hour(message.at)}
                </time>
              </div>
            ) : (
              <div key={index} className="flex max-w-[92%] gap-2 self-start">
                <Venito className="mt-1 size-8" compact />
                <div className="flex min-w-0 flex-col items-start gap-1">
                  <div className="rounded-card rounded-bl-block surface px-4 py-3 text-ink">
                    <span className="sr-only">Venito: </span>
                    <p className="whitespace-pre-line">{message.content}</p>
                    <CitedEvents
                      events={message.events ?? []}
                      timeZone={timeZone}
                    />
                    {message.actions?.map((card) => (
                      <ActionCard
                        key={card.action.key}
                        card={card}
                        timeZone={timeZone}
                        onChanged={onChanged}
                        onChange={(next) =>
                          setMessages((current) =>
                            current.map((item, i) =>
                              i === index && item.actions
                                ? {
                                    ...item,
                                    actions: item.actions.map((other) =>
                                      other.action.key === card.action.key
                                        ? next
                                        : other,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    ))}
                    {message.proposal ? (
                      <ProposalCard
                        proposal={message.proposal}
                        calendars={calendars}
                        onChange={(proposal) =>
                          setMessages((current) =>
                            current.map((item, i) =>
                              i === index ? { ...item, proposal } : item,
                            ),
                          )
                        }
                      />
                    ) : null}
                  </div>
                  <time className="px-1 text-xs text-muted tabular-nums">
                    {hour(message.at)}
                  </time>
                </div>
              </div>
            ),
          )}
        </div>

        {/* "Escribiendo…": the real step, as the server tells it (spec 024 RF-17). */}
        <div role="status" className="flex items-end gap-2 empty:hidden">
          {pending ? (
            <>
              <Venito mood="thinking" className="size-8" compact />
              <div className="flex items-center gap-3 rounded-card rounded-bl-block surface px-4 py-2">
                <span
                  data-typing=""
                  aria-hidden="true"
                  className="flex items-center gap-1"
                >
                  <span className="size-1.5 rounded-full bg-muted" />
                  <span className="size-1.5 rounded-full bg-muted" />
                  <span className="size-1.5 rounded-full bg-muted" />
                </span>
                <span className="text-sm text-muted">{status}</span>
              </div>
              <Button
                variant="quiet"
                onClick={() => controller.current?.abort()}
              >
                Cancelar
              </Button>
            </>
          ) : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-card border border-danger bg-paper px-4 py-3 text-danger"
          >
            <Venito
              mood={quotaReached ? "sleeping" : "confused"}
              className="size-10"
              compact
            />
            <span className="min-w-0 flex-1">{error.text}</span>
            {error.retry ? (
              <Button variant="secondary" onClick={() => void send(draft)}>
                Reintentar
              </Button>
            ) : null}
          </div>
        ) : null}
        <div ref={end} />
      </div>

      {/* Anchored at the bottom; the panel follows the keyboard (plan D6). */}
      <form
        noValidate
        className="flex flex-col gap-2 border-t border-line bg-paper px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <ul
          aria-label="Sugerencias"
          className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]"
        >
          {chips.map((suggestion) => (
            <li key={suggestion.label} className="shrink-0">
              <Chip
                disabled={pending || quotaReached}
                onClick={() => pick(suggestion)}
              >
                {suggestion.label}
              </Chip>
            </li>
          ))}
        </ul>
        {empty || attachments.length > 0 ? <AttachNote /> : null}
        <AttachPreview
          attachments={attachments}
          errors={attachErrors}
          onRemove={(id) =>
            setAttachments((current) =>
              current.filter((attachment) => attachment.id !== id),
            )
          }
        />
        <div className="flex items-end gap-1">
          <ImageAttach
            picker={picker}
            disabled={pending || quotaReached}
            onPick={(files) => void addFiles(files)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <label htmlFor={fieldId} className="sr-only">
              Tu pregunta
            </label>
            <textarea
              id={fieldId}
              ref={field}
              name="question"
              rows={Math.min(4, Math.max(1, draft.split("\n").length))}
              value={draft}
              placeholder="Escribe a Venito…"
              disabled={quotaReached}
              aria-invalid={Boolean(fieldError)}
              aria-describedby={fieldError ? `${fieldId}-error` : undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              // 16 px: below it iOS zooms the page in (amendment 10).
              className="min-h-11 w-full resize-none rounded-card border border-control bg-paper px-4 py-2.5 text-base text-ink outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/20 aria-invalid:border-danger"
            />
          </div>
          <button
            type="submit"
            aria-label="Enviar"
            disabled={pending || quotaReached}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-accent-edge bg-accent text-on-accent press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendIcon />
          </button>
        </div>
        {fieldError ? (
          <p
            id={`${fieldId}-error`}
            aria-live="polite"
            className="text-sm text-danger"
          >
            {fieldError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
