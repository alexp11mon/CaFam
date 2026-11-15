// What POST /api/assistant sends while it works (spec 024 RF-16, plan D7):
// one JSON object per line. Pure, shared by the route and the chat.
import type { Proposal } from "./proposal";
import type { CitedEvent } from "./tools";

export const NDJSON = "application/x-ndjson";

export type StreamLine =
  /** What the assistant is doing right now, for the person waiting. */
  | { type: "status"; text: string }
  /** The answer: what the route returned as JSON before this spec. */
  | {
      type: "done";
      answer: string;
      events: CitedEvent[];
      proposal?: Proposal;
      remaining: number;
    }
  /** A failure once the stream has started; `retry` offers "Reintentar". */
  | { type: "error"; text: string; retry: boolean };

export const STATUS = {
  start: "Pensando…",
  events: "Mirando tu calendario…",
  free: "Calculando huecos libres…",
  comments: "Leyendo los comentarios…",
  writing: "Escribiendo la respuesta…",
  image: "Leyendo la imagen…",
  proposal: "Revisando la propuesta…",
} as const;

/** The step a tool call stands for, in the user's words. */
export function statusFor(tool: string, args: string): string {
  if (tool === "search_events") {
    let query = "";
    try {
      const parsed: unknown = JSON.parse(args);
      if (
        parsed &&
        typeof parsed === "object" &&
        "query" in parsed &&
        typeof parsed.query === "string"
      ) {
        query = parsed.query.trim().slice(0, 40);
      }
    } catch {
      // A malformed call: the tool will say so; the status stays generic.
    }
    return query ? `Buscando «${query}»…` : "Buscando en tus eventos…";
  }
  if (tool === "find_free_time") return STATUS.free;
  if (tool === "get_comments") return STATUS.comments;
  return STATUS.events;
}

export function encodeLine(line: StreamLine): string {
  return `${JSON.stringify(line)}\n`;
}

/**
 * The lines of a response body as they arrive. A line can come split between
 * two chunks, and several in one; anything that is not a known line is
 * skipped.
 */
export async function* readLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamLine> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let rest = "";
  const parse = (text: string): StreamLine | null => {
    if (!text.trim()) return null;
    try {
      const line: unknown = JSON.parse(text);
      if (
        line &&
        typeof line === "object" &&
        "type" in line &&
        (line.type === "status" ||
          line.type === "done" ||
          line.type === "error")
      ) {
        return line as StreamLine;
      }
    } catch {
      // Not a line of ours.
    }
    return null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      rest += decoder.decode(value, { stream: !done });
      const lines = rest.split("\n");
      rest = done ? "" : lines.pop()!;
      for (const text of lines) {
        const line = parse(text);
        if (line) yield line;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
