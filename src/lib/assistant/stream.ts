// What POST /api/assistant sends while it works (spec 024 RF-16, plan D7):
// one JSON object per line. Pure, shared by the route and the chat.
import type { AssistantAction } from "./actions";
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
      /** Spec 036: what was created or proposed in this answer. */
      actions?: AssistantAction[];
      remaining: number;
    }
  /** Spec 036 (plan D12): sent as soon as something is written or proposed. */
  | { type: "action"; action: AssistantAction }
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
  creating: "Creando el evento…",
  change: "Preparando el cambio…",
} as const;

/** The first title of a create_events call, for "Creando «…»…" (spec 036 RF-46). */
function firstTitle(args: string): string {
  try {
    const parsed: unknown = JSON.parse(args);
    if (
      parsed &&
      typeof parsed === "object" &&
      "events" in parsed &&
      Array.isArray(parsed.events)
    ) {
      const first: unknown = parsed.events[0];
      if (
        first &&
        typeof first === "object" &&
        "title" in first &&
        typeof first.title === "string"
      ) {
        return first.title.trim().slice(0, 40);
      }
    }
  } catch {
    // A malformed call: the tool will say so; the status stays generic.
  }
  return "";
}

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
  if (tool === "create_events") {
    const title = firstTitle(args);
    return title ? `Creando «${title}»…` : STATUS.creating;
  }
  if (tool === "propose_changes") return STATUS.change;
  if (tool === "find_free_time") return STATUS.free;
  if (tool === "get_comments") return STATUS.comments;
  // Spec 048 RF-12, RF-14.
  if (tool === "list_notes") return "Mirando tus notas…";
  if (tool === "create_notes" || tool === "add_note_items")
    return "Apuntando en tus notas…";
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
          line.type === "action" ||
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
