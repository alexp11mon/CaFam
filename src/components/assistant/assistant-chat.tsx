"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import {
  NETWORK_TEXT,
  QUESTION_MESSAGES,
  UNAVAILABLE_TEXT,
} from "@/lib/assistant/error-messages";
import { checkAttachments } from "@/lib/assistant/attachments";
import { MAX_MESSAGES, QUESTION_MAX } from "@/lib/assistant/limits";
import type { Proposal } from "@/lib/assistant/proposal";
import type { CitedEvent } from "@/lib/assistant/tools";
import { prepareForAssistant } from "@/lib/images/prepare-image";
import { CitedEvents } from "./cited-events";
import { ImageAttach, type Attachment } from "./image-attach";
import { ProposalCard } from "./proposal-card";

// The chat of the assistant (spec 015 plan assistant-ui). The thread lives
// only in this component: leaving the page or "Nueva conversación" forgets it
// (RF-6).

interface Message {
  role: "user" | "assistant";
  content: string;
  events?: CitedEvent[];
  /** Spec 022 RF-11: the images sent with this message, as data URLs. */
  images?: string[];
  proposal?: ChatProposal;
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

const EXAMPLES = [
  "¿Qué tengo este fin de semana?",
  "¿Cuándo es el próximo cumpleaños?",
  "¿Qué tardes tengo libres la semana que viene?",
];

export function AssistantChat({
  timeZone,
  calendars = [],
}: {
  timeZone: string;
  calendars?: readonly ChatCalendar[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachErrors, setAttachErrors] = useState<string[]>([]);
  // Plan D2: images re-sent while the assistant asks before proposing.
  const carried = useRef<string[]>([]);
  const preparing = useRef(0);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<{ text: string; retry: boolean }>();
  const [pending, setPending] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
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
      ...(attached.length ? { images } : {}),
    };
    // Plan D2: images travel only with the last message.
    const thread = [
      ...messages.map(({ role, content }) => ({ role, content })),
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
    setPending(true);
    const abort = new AbortController();
    controller.current = abort;

    // On failure or cancel the question and its images go back (RF-4, RF-28;
    // spec 022 RF-54, RF-55).
    const giveBack = () => {
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
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        giveBack();
        // RF-27: the quota is over until tomorrow, retrying would not help.
        if (response.status === 429) setQuotaReached(true);
        setError({
          text: body.error ?? UNAVAILABLE_TEXT,
          retry: response.status === 503,
        });
        return;
      }
      const proposal: Proposal | undefined = body.proposal;
      // Plan D2: the assistant asked something before proposing.
      carried.current = !proposal && images.length ? images : [];
      setMessages((current) => [
        // RF-34: a new proposal replaces the pending one.
        ...current.map((message) =>
          proposal && message.proposal?.status === "pending"
            ? {
                ...message,
                proposal: {
                  ...message.proposal,
                  status: "superseded" as const,
                },
              }
            : message,
        ),
        {
          role: "assistant",
          content: body.answer,
          events: body.events,
          ...(proposal
            ? { proposal: { ...proposal, status: "pending" as const } }
            : {}),
        },
      ]);
    } catch {
      giveBack();
      if (!abort.signal.aborted) setError({ text: NETWORK_TEXT, retry: true });
    } finally {
      if (controller.current === abort) controller.current = null;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink max-tab:sr-only">
          Asistente
        </h1>
        <Button variant="secondary" onClick={restart}>
          Nueva conversación
        </Button>
      </div>

      {messages.length === 0 && !pending ? (
        <section className="glass flex flex-col gap-4 rounded-3xl p-5">
          {/* RF-33: say where the data goes before the first question. */}
          <p className="text-sm text-muted">
            Pregúntame por tus eventos o por cuándo estáis libres. Tus preguntas
            y los eventos necesarios para responderlas se envían a Groq, que no
            los usa para entrenar. Más detalles en la{" "}
            <Link
              href="/privacy"
              className="font-semibold text-ink underline decoration-control underline-offset-4"
            >
              política de privacidad
            </Link>
            .
          </p>
          <ul
            aria-label="Ejemplos de preguntas"
            className="flex flex-wrap gap-2"
          >
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  disabled={quotaReached}
                  onClick={() => void send(example)}
                  className="min-h-11 rounded-full border border-control bg-paper px-4 py-2 text-left text-sm font-medium text-ink press hover:bg-stone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
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
            <p
              key={index}
              className="max-w-[85%] self-end rounded-3xl rounded-br-lg bg-ink px-4 py-2 whitespace-pre-line text-on-ink"
            >
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
                      className="size-20 rounded-xl object-cover"
                    />
                  ))}
                </span>
              ) : null}
            </p>
          ) : (
            <div
              key={index}
              className="glass max-w-[92%] self-start rounded-3xl rounded-bl-lg px-4 py-3 text-ink"
            >
              <span className="sr-only">Asistente: </span>
              <p className="whitespace-pre-line">{message.content}</p>
              <CitedEvents events={message.events ?? []} timeZone={timeZone} />
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
          ),
        )}
      </div>

      <div role="status" className="flex items-center gap-3 empty:hidden">
        {pending ? (
          <>
            <span className="text-muted">Pensando…</span>
            <Button
              variant="secondary"
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
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger bg-paper px-4 py-3 text-danger"
        >
          <span>{error.text}</span>
          {error.retry ? (
            <Button variant="secondary" onClick={() => void send(draft)}>
              Reintentar
            </Button>
          ) : null}
        </div>
      ) : null}
      <div ref={end} />

      <form
        noValidate
        className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-stone pt-2 pb-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <TextArea
          ref={field}
          label="Tu pregunta"
          name="question"
          rows={2}
          value={draft}
          error={fieldError}
          disabled={quotaReached}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <ImageAttach
            attachments={attachments}
            errors={attachErrors}
            disabled={pending || quotaReached}
            onPick={(files) => void addFiles(files)}
            onRemove={(id) =>
              setAttachments((current) =>
                current.filter((attachment) => attachment.id !== id),
              )
            }
          />
          <Button
            type="submit"
            disabled={pending || quotaReached}
            className="ml-auto self-end"
          >
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
