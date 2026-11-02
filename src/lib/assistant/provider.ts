// The only client of Groq (spec 015 plan assistant-provider, D1). Server only:
// it reads GROQ_API_KEY (P4) and no client component may import it.

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** R5: per call; the route allows 30 s in total. */
const CALL_TIMEOUT_MS = 8_000;

/** D1: main model, then the fallback after a 429 (each has its own limit, R1). */
export const ASSISTANT_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
] as const;

/**
 * RF-31, D12: Groq's Services Agreement (4.2) forbids training on inputs and
 * outputs. If a provider ever did, the tools would leave out Google calendars.
 */
export const PROVIDER_TRAINS_ON_DATA = false;

/** RF-28: the provider did not answer, refused or ran out of free quota. */
export class AssistantUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AssistantUnavailable";
  }
}

export interface ToolDefinition {
  type: "function";
  function: { name: string; description: string; parameters: object };
}

interface RawToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ProviderMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: RawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ProviderReply {
  content: string | null;
  toolCalls: ToolCall[];
  /** The assistant message as received, to send back with the tool results. */
  message: ProviderMessage;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

async function callModel(
  model: string,
  key: string,
  messages: readonly ProviderMessage[],
  tools: readonly ToolDefinition[],
  signal: AbortSignal | undefined,
  fetcher: Fetcher,
): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), CALL_TIMEOUT_MS);
  try {
    return await fetcher(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
      }),
      signal: signal
        ? AbortSignal.any([signal, timeout.signal])
        : timeout.signal,
    });
  } catch (error) {
    // A user's cancellation goes through (RF-4); anything else is RF-28.
    if (signal?.aborted) throw error;
    throw new AssistantUnavailable(
      timeout.signal.aborted ? "timeout" : `network: ${String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function chat(
  messages: readonly ProviderMessage[],
  tools: readonly ToolDefinition[],
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<ProviderReply> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AssistantUnavailable("missing GROQ_API_KEY");

  let response: Response | undefined;
  for (const model of ASSISTANT_MODELS) {
    response = await callModel(model, key, messages, tools, signal, fetcher);
    if (response.status !== 429) break;
  }
  if (!response?.ok) {
    throw new AssistantUnavailable(`status ${response?.status}`);
  }

  let message: Extract<ProviderMessage, { role: "assistant" }> | undefined;
  try {
    const body = (await response.json()) as {
      choices?: { message?: typeof message }[];
    };
    message = body.choices?.[0]?.message;
  } catch {
    message = undefined;
  }
  if (!message || message.role !== "assistant") {
    throw new AssistantUnavailable("malformed answer");
  }
  return {
    content: message.content ?? null,
    toolCalls: (message.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    })),
    message,
  };
}
