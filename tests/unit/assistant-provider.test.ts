// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_MODELS,
  AssistantUnavailable,
  PROVIDER_TRAINS_ON_DATA,
  chat,
} from "@/lib/assistant/provider";

// Spec 015, T5: the only client of Groq (plan assistant-provider, D1, D12;
// RF-4, RF-28, RF-31).
const TOOLS = [
  {
    type: "function" as const,
    function: { name: "list_events", description: "x", parameters: {} },
  },
];
const MESSAGES = [{ role: "user" as const, content: "¿Qué hay hoy?" }];

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const textReply = (content: string) =>
  reply({ choices: [{ message: { role: "assistant", content } }] });

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "gsk_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("chat", () => {
  it("sends the model, temperature 0, messages, tools, key and signal", async () => {
    const fetcher = vi.fn().mockResolvedValue(textReply("Nada hoy."));
    const signal = new AbortController().signal;
    const result = await chat(MESSAGES, TOOLS, signal, fetcher);

    expect(result).toEqual({
      content: "Nada hoy.",
      toolCalls: [],
      message: { role: "assistant", content: "Nada hoy." },
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer gsk_test");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      model: ASSISTANT_MODELS[0],
      temperature: 0,
      messages: MESSAGES,
      tools: TOOLS,
    });
  });

  it("leaves out the tools when there are none (last round, T7)", async () => {
    const fetcher = vi.fn().mockResolvedValue(textReply("Listo."));
    await chat(MESSAGES, [], undefined, fetcher);
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).not.toHaveProperty(
      "tools",
    );
  });

  it("returns the tool calls", async () => {
    const toolCall = {
      id: "call_1",
      type: "function",
      function: { name: "list_events", arguments: '{"from":"2026-11-07"}' },
    };
    const fetcher = vi.fn().mockResolvedValue(
      reply({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [toolCall],
            },
          },
        ],
      }),
    );
    const result = await chat(MESSAGES, TOOLS, undefined, fetcher);
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "list_events", arguments: '{"from":"2026-11-07"}' },
    ]);
    expect(result.message).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [toolCall],
    });
  });

  it("retries once with the fallback model after a 429 (D1)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: { message: "rate" } }, 429))
      .mockResolvedValueOnce(textReply("Hola"));
    const result = await chat(MESSAGES, TOOLS, undefined, fetcher);
    expect(result.content).toBe("Hola");
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).model).toBe(
      ASSISTANT_MODELS[1],
    );
  });

  it("is unavailable when both models answer 429", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => reply({ error: {} }, 429));
    await expect(
      chat(MESSAGES, TOOLS, undefined, fetcher),
    ).rejects.toBeInstanceOf(AssistantUnavailable);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 500, 503])("is unavailable on %i", async (status) => {
    const fetcher = vi.fn().mockResolvedValue(reply({ error: {} }, status));
    await expect(
      chat(MESSAGES, TOOLS, undefined, fetcher),
    ).rejects.toBeInstanceOf(AssistantUnavailable);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("is unavailable on a network error or a malformed answer", async () => {
    await expect(
      chat(
        MESSAGES,
        TOOLS,
        undefined,
        vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      ),
    ).rejects.toBeInstanceOf(AssistantUnavailable);
    await expect(
      chat(
        MESSAGES,
        TOOLS,
        undefined,
        vi.fn().mockResolvedValue(reply({ nope: 1 })),
      ),
    ).rejects.toBeInstanceOf(AssistantUnavailable);
  });

  it("is unavailable after 8 s", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(init.signal!.reason),
          );
        }),
    );
    const pending = chat(MESSAGES, TOOLS, undefined, fetcher);
    const check = expect(pending).rejects.toBeInstanceOf(AssistantUnavailable);
    await vi.advanceTimersByTimeAsync(8_000);
    await check;
  });

  it("lets a user's cancellation through as an AbortError (RF-4)", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = chat(MESSAGES, TOOLS, controller.signal, fetcher);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("is unavailable without GROQ_API_KEY and does not call", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const fetcher = vi.fn();
    await expect(
      chat(MESSAGES, TOOLS, undefined, fetcher),
    ).rejects.toBeInstanceOf(AssistantUnavailable);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("provider terms (RF-31, D12)", () => {
  it("Groq does not train on the data", () => {
    expect(PROVIDER_TRAINS_ON_DATA).toBe(false);
  });
});
