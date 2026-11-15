// Spec 024: measurement only. Preloaded into `next start` with
//   NODE_OPTIONS="--import ./scripts/perf/mock-groq.mjs"
// it answers the calls to Groq with a fixed delay, so the app's own overhead
// can be measured without spending quota. Never part of the app.
const real = globalThis.fetch;
const delay = Number(process.env.MOCK_GROQ_MS ?? 900);
let id = 0;

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input.url ?? String(input));
  if (!url.startsWith("https://api.groq.com/")) return real(input, init);
  await new Promise((done) => setTimeout(done, delay));
  if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
  const body = JSON.parse(init.body);
  const asked = body.messages.some((m) => m.role === "tool");
  const today = new Date().toISOString().slice(0, 10);
  const message =
    !asked && body.tools?.length
      ? {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `call_${++id}`,
              type: "function",
              function: {
                name: "list_events",
                arguments: JSON.stringify({ from: today, to: today }),
              },
            },
          ],
        }
      : { role: "assistant", content: "Hoy tienes varios eventos [e1]." };
  return new Response(
    JSON.stringify({ choices: [{ message, finish_reason: "stop" }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
