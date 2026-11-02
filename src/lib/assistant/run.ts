import { createRefs, extractCitations, type Refs } from "./citations";
import { dateContext } from "./dates";
import { MAX_TOOL_ROUNDS } from "./limits";
import { systemPrompt } from "./prompt";
import {
  AssistantUnavailable,
  type ProviderMessage,
  type ProviderReply,
  type ToolDefinition,
} from "./provider";
import type { ChatMessage } from "./schemas";
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
  ) => Promise<ProviderReply>;
  runTool: (
    name: string,
    args: string,
    refs: Refs<CitedEvent>,
  ) => Promise<object>;
  now: Date;
  timeZone: string;
}

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
    const reply = await deps.chat(messages, tools, signal);
    if (reply.toolCalls.length === 0 || tools.length === 0) {
      const { text, cited } = extractCitations(reply.content ?? "", refs);
      if (!text) throw new AssistantUnavailable("empty answer");
      return { answer: text, events: cited };
    }
    messages.push(reply.message);
    for (const call of reply.toolCalls) {
      const result = await deps.runTool(call.name, call.arguments, refs);
      signal?.throwIfAborted();
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
}
