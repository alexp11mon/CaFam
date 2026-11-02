"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import {
  NETWORK_TEXT,
  QUESTION_MESSAGES,
  UNAVAILABLE_TEXT,
} from "@/lib/assistant/error-messages";
import { MAX_MESSAGES, QUESTION_MAX } from "@/lib/assistant/limits";
import type { CitedEvent } from "@/lib/assistant/tools";
import { CitedEvents } from "./cited-events";

// The chat of the assistant (spec 015 plan assistant-ui). The thread lives
// only in this component: leaving the page or "Nueva conversación" forgets it
// (RF-6).

interface Message {
  role: "user" | "assistant";
  content: string;
  events?: CitedEvent[];
}

const EXAMPLES = [
  "¿Qué tengo este fin de semana?",
  "¿Cuándo es el próximo cumpleaños?",
  "¿Qué tardes tengo libres la semana que viene?",
];

export function AssistantChat({ timeZone }: { timeZone: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
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

  async function send(text: string) {
    if (pending || quotaReached) return;
    const question = text.trim();
    // RF-3, the same rules as the server.
    if (!question || question.length > QUESTION_MAX) {
      setFieldError(
        question ? QUESTION_MESSAGES.tooLong : QUESTION_MESSAGES.empty,
      );
      field.current?.focus();
      return;
    }
    const asked: Message = { role: "user", content: question };
    const thread = [...messages, asked]
      .slice(-MAX_MESSAGES)
      .map(({ role, content }) => ({ role, content }));
    setFieldError(undefined);
    setError(undefined);
    setMessages((current) => [...current, asked]);
    setDraft("");
    setPending(true);
    const abort = new AbortController();
    controller.current = abort;

    // On failure or cancel the question goes back to the field (RF-4, RF-28).
    const giveBack = () => {
      setMessages((current) => current.filter((message) => message !== asked));
      setDraft(text);
    };
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: thread }),
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
      setMessages((current) => [
        ...current,
        { role: "assistant", content: body.answer, events: body.events },
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
    setMessages([]);
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
        <h1 className="text-2xl font-bold text-ink">Asistente</h1>
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
            </p>
          ) : (
            <div
              key={index}
              className="glass max-w-[92%] self-start rounded-3xl rounded-bl-lg px-4 py-3 text-ink"
            >
              <span className="sr-only">Asistente: </span>
              <p className="whitespace-pre-line">{message.content}</p>
              <CitedEvents events={message.events ?? []} timeZone={timeZone} />
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
        className="sticky bottom-0 mt-auto flex flex-col gap-2 pb-2"
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
        />
        <Button
          type="submit"
          disabled={pending || quotaReached}
          className="self-end"
        >
          Enviar
        </Button>
      </form>
    </div>
  );
}
