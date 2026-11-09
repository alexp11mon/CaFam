import { createRefs, extractCitations, type Refs } from "./citations";
import { dateContext } from "./dates";
import { MAX_TOOL_ROUNDS } from "./limits";
import { proposalPrompt, systemPrompt } from "./prompt";
import { buildProposal, type Proposal, type ProposalDeps } from "./proposal";
import {
  AssistantUnavailable,
  type ProviderMessage,
  type ProviderReply,
  type ToolDefinition,
} from "./provider";
import type { ChatMessage, ProposalRow } from "./schemas";
import { TOOL_DEFINITIONS } from "./tool-definitions";
import type { CitedEvent } from "./tools";

// The model-tools loop of one question (spec 015 plan assistant-run, D2).
// Dependencies are injected, like run-sync: the route binds runTool to the
// user's session, so nothing in the thread can change who the tools act as
// (RF-29).

export interface RunDeps {
  chat: (
    messages: readonly ProviderMessage[],
    tools: readonly ToolDefinition[],
    signal?: AbortSignal,
    requireTool?: boolean,
  ) => Promise<ProviderReply>;
  runTool: (
    name: string,
    args: string,
    refs: Refs<CitedEvent>,
  ) => Promise<object>;
  now: Date;
  timeZone: string;
}

/** Sent before the forced answer: without it gpt-oss still tried a tool (400). */
export const FINAL_ROUND =
  "Ya no puedes usar herramientas. Responde ahora al usuario solo con los datos que ya tienes.";

export interface AssistantAnswer {
  answer: string;
  events: CitedEvent[];
}

export async function runAssistant(
  thread: readonly ChatMessage[],
  deps: RunDeps,
  signal?: AbortSignal,
): Promise<AssistantAnswer> {
  const refs = createRefs<CitedEvent>();
  // RF-22: what the tools say must be said is said by the server, not left
  // to the model, which sometimes dropped it (T12).
  const notices = new Set<string>();
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: systemPrompt(
        dateContext(deps.now, deps.timeZone),
        deps.timeZone,
      ),
    },
    ...thread,
  ];

  for (let round = 0; ; round++) {
    signal?.throwIfAborted();
    // After the last round of tools, no more tools: the model must answer.
    const tools = round < MAX_TOOL_ROUNDS ? TOOL_DEFINITIONS : [];
    if (tools.length === 0)
      messages.push({ role: "system", content: FINAL_ROUND });
    // The first round must look at the data: without it the fallback model
    // answered "no events" without asking (T12, RF-12, RF-13).
    const reply = await deps.chat(messages, tools, signal, round === 0);
    if (reply.toolCalls.length === 0 || tools.length === 0) {
      const { text, cited } = extractCitations(reply.content ?? "", refs);
      if (!text) throw new AssistantUnavailable("empty answer");
      const missing = [...notices].filter((notice) => !text.includes(notice));
      return {
        answer: [...missing, text].join("\n\n"),
        events: cited,
      };
    }
    messages.push(reply.message);
    for (const call of reply.toolCalls) {
      const result = await deps.runTool(call.name, call.arguments, refs);
      signal?.throwIfAborted();
      if ("notice" in result && typeof result.notice === "string") {
        notices.add(result.notice);
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
}

export interface ProposalRunDeps {
  /** One JSON answer; `vision` picks the model that reads images (D1, D2). */
  json: (
    messages: readonly ProviderMessage[],
    vision: boolean,
    signal?: AbortSignal,
  ) => Promise<string>;
  proposal: ProposalDeps;
  now: Date;
  timeZone: string;
}

/** RF-12: images sent without text still need a user text part. */
const IMAGES_ONLY_TEXT = "Aquí tienes mi horario.";

/**
 * Spec 022 (plan "run", D1b, D2, D3): a proposal from the images of the last
 * message, or the correction of the current one. Never writes (RF-40).
 */
export async function runProposal(
  thread: readonly ChatMessage[],
  current: readonly ProposalRow[] | undefined,
  deps: ProposalRunDeps,
  signal?: AbortSignal,
): Promise<AssistantAnswer & { proposal?: Proposal }> {
  signal?.throwIfAborted();
  const last = thread.at(-1);
  const images = last?.role === "user" ? (last.images ?? []) : [];
  const messages: ProviderMessage[] = [
    {
      role: "system",
      content: proposalPrompt(
        dateContext(deps.now, deps.timeZone),
        deps.timeZone,
      ),
    },
  ];
  // RF-33: the rows the user kept, with calendar names and never ids.
  const kept = (current ?? []).filter((row) => row.selected);
  if (kept.length > 0) {
    const name = new Map(deps.proposal.calendars.map((c) => [c.id, c.name]));
    const events = kept.map((row) => ({
      title: row.title,
      date: row.startDate,
      start: row.start,
      end: row.end,
      endDate: row.endDate === row.startDate ? null : row.endDate,
      allDay: row.allDay,
      calendar: name.get(row.calendarId) ?? null,
    }));
    messages.push({
      role: "system",
      content: `Propuesta actual: ${JSON.stringify({ events })}`,
    });
  }
  for (const message of thread) {
    if (message === last && images.length > 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: message.content || IMAGES_ONLY_TEXT },
          ...images.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      });
    } else {
      messages.push(
        message.role === "user"
          ? { role: "user", content: message.content }
          : { role: "assistant", content: message.content },
      );
    }
  }

  const raw = await deps.json(messages, images.length > 0, signal);
  signal?.throwIfAborted();
  const result = await buildProposal(raw, deps.proposal);
  return result.kind === "proposal"
    ? { answer: result.text, events: [], proposal: result.proposal }
    : { answer: result.text, events: [] };
}
