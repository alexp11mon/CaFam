// The only client of Groq (spec 015 plan assistant-provider, D1). Server only:
// it reads GROQ_API_KEY (P4) and no client component may import it.

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/** R5: per call; the route allows 45 s in total. */
const CALL_TIMEOUT_MS = 8_000;
/** Spec 022, D6: reading images takes longer. */
const VISION_TIMEOUT_MS = 20_000;

/** D1: main model, then the fallback after a 429 (each has its own limit, R1). */
export const ASSISTANT_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
] as const;

/**
 * Spec 022, D1: the only model of Groq's free tier that reads images. Tools
 * failed with images in T1, so it answers JSON (D3); no fallback reads images.
 */
export const VISION_MODEL = "qwen/qwen3.8-27b";

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

/** Spec 022: text and images of one user message (OpenAI format). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ProviderMessage =
  | { role: "system" | "user"; content: string }
  | { role: "user"; content: ContentPart[] }
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
  key: string,
  body: object,
  signal: AbortSignal | undefined,
  fetcher: Fetcher,
  timeoutMs = CALL_TIMEOUT_MS,
): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  try {
    return await fetcher(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

/** Groq's error code, for the logs: never the message, which may quote the request. */
async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown } };
    return typeof body.error?.code === "string" ? body.error.code : "";
  } catch {
    return "";
  }
}

/**
 * The other model has its own limits and may manage: per-minute quota (429,
 * 413 for a request over the 8K tokens), a broken tool call or a server error.
 * A bad key or request would fail the same way.
 */
const worthFallback = (status: number, code: string) =>
  status === 429 ||
  status === 413 ||
  status >= 500 ||
  (status === 400 && code === "tool_use_failed");

export async function chat(
  messages: readonly ProviderMessage[],
  tools: readonly ToolDefinition[],
  signal?: AbortSignal,
  /** The model must call a tool before it may answer (T12, RF-13). */
  requireTool = false,
  fetcher: Fetcher = fetch,
): Promise<ProviderReply> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AssistantUnavailable("missing GROQ_API_KEY");

  let response: Response | undefined;
  let failure = "";
  for (const model of ASSISTANT_MODELS) {
    response = await callModel(
      key,
      {
        model,
        temperature: 0,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        ...(requireTool ? { tool_choice: "required" } : {}),
      },
      signal,
      fetcher,
    );
    if (response.ok) break;
    const code = await errorCode(response);
    failure = `status ${response.status} ${code}`.trim();
    if (!worthFallback(response.status, code)) break;
  }
  if (!response?.ok) throw new AssistantUnavailable(failure);

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

/**
 * Spec 022 (D1, D3, D6): one call to the vision model, which must answer a
 * JSON object. No fallback: no other free model reads images (R2).
 */
export function visionChat(
  messages: readonly ProviderMessage[],
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
): Promise<string> {
  return jsonChat(messages, [VISION_MODEL], signal, fetcher, VISION_TIMEOUT_MS);
}

/**
 * Spec 022 (D2, D3): a JSON answer from the first model that gives one; the
 * corrections of a proposal use the text models with their fallback.
 */
export async function jsonChat(
  messages: readonly ProviderMessage[],
  models: readonly string[] = ASSISTANT_MODELS,
  signal?: AbortSignal,
  fetcher: Fetcher = fetch,
  timeoutMs = CALL_TIMEOUT_MS,
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AssistantUnavailable("missing GROQ_API_KEY");
  let response: Response | undefined;
  let failure = "";
  for (const model of models) {
    response = await callModel(
      key,
      {
        model,
        temperature: 0,
        messages,
        response_format: { type: "json_object" },
      },
      signal,
      fetcher,
      timeoutMs,
    );
    if (response.ok) break;
    const code = await errorCode(response);
    failure = `status ${response.status} ${code}`.trim();
    if (!worthFallback(response.status, code)) break;
  }
  if (!response?.ok) throw new AssistantUnavailable(failure);
  try {
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content === "string" && content) return content;
  } catch {
    // Falls through to the error below.
  }
  throw new AssistantUnavailable("malformed answer");
}
