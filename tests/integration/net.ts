// Spec 051 RF-10, RF-11: test:db against Supabase dev fails clearly instead
// of hanging, and user management survives the network and Auth's rate limit.

/** A fetch that gives up after `ms`, saying which call hung. */
export function timedFetch(
  base: typeof fetch = fetch,
  ms = 15_000,
): typeof fetch {
  return async (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;
    try {
      return await base(input, { ...init, signal });
    } catch (error) {
      if (!timeout.aborted) throw error;
      const url = input instanceof Request ? input.url : String(input);
      throw new Error(`Supabase dev no respondió en ${ms / 1000} s: ${url}`, {
        cause: error,
      });
    }
  };
}

function retryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status, message } = error as Record<string, unknown>;
  return (
    status === 429 ||
    name === "AuthRetryableFetchError" ||
    /rate limit|fetch failed|ECONNRESET|socket|no respondió/i.test(
      String(message ?? ""),
    )
  );
}

const WAITS = [2000, 5000];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a Supabase call again, twice at most, only on a network or rate-limit
 * error (thrown or returned in `error`). Never for test assertions.
 */
export async function withRetry<T extends { error: unknown }>(
  call: () => Promise<T>,
  sleep: (ms: number) => Promise<unknown> = wait,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const last = attempt === WAITS.length;
    try {
      const result = await call();
      if (last || !retryable(result.error)) return result;
    } catch (error) {
      if (last || !retryable(error)) throw error;
    }
    await sleep(WAITS[attempt]);
  }
}
