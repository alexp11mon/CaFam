import { lookup as dnsLookup } from "node:dns";
import { request as httpsRequest } from "node:https";
import { FETCH_TIMEOUT_MS, MAX_BYTES, MAX_REDIRECTS } from "./limits";
import { isPublicAddress } from "./ip-guard";
import { parseSourceUrl } from "./source-url";

// Downloads an .ics link once, from the server (RF-1). Nothing here stores or
// logs the URL, and no error carries it (RF-6).

export type FetchError = "invalid-url" | "unreachable" | "too-large";
export type FetchResult =
  { ok: true; text: string } | { ok: false; error: FetchError };

export interface RawResponse {
  status: number;
  location: string | undefined;
  body: AsyncIterable<Uint8Array>;
  destroy: () => void;
}

export type Transport = (url: URL, signal: AbortSignal) => Promise<RawResponse>;

const BLOCKED = "ICS_BLOCKED_ADDRESS";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type Address = { address: string; family: number };
type DnsLookup = (
  hostname: string,
  options: { all: true },
  callback: (error: Error | null, addresses?: Address[]) => void,
) => void;

/**
 * A `lookup` for sockets that refuses private addresses *when the connection
 * is made*, so a name cannot resolve to a safe IP when checked and to a
 * private one when used (DNS rebinding, plan D6).
 */
export function createGuardedLookup(resolve: DnsLookup) {
  return (
    hostname: string,
    options: { all?: boolean },
    callback: (error: Error | null, ...rest: unknown[]) => void,
  ) => {
    resolve(hostname, { ...options, all: true }, (error, addresses) => {
      if (error || !addresses)
        return callback(error ?? new Error("no address"));
      if (
        addresses.length === 0 ||
        !addresses.every((a) => isPublicAddress(a.address))
      ) {
        return callback(
          Object.assign(new Error("Address not allowed"), { code: BLOCKED }),
        );
      }
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

export const guardedLookup = createGuardedLookup(
  dnsLookup as unknown as DnsLookup,
);

const httpsTransport: Transport = (url, signal) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
          "user-agent": "CalenderFam-import",
        },
        lookup: guardedLookup as never,
        signal,
      },
      (res) =>
        resolve({
          status: res.statusCode ?? 0,
          location: res.headers.location,
          body: res,
          destroy: () => res.destroy(),
        }),
    );
    req.on("error", reject);
    req.end();
  });

async function readBody(response: RawResponse): Promise<string | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_BYTES) {
      response.destroy();
      return null;
    }
    chunks.push(chunk);
  }
  return new TextDecoder("utf-8")
    .decode(Buffer.concat(chunks))
    .replace(/^﻿/, "");
}

async function download(
  start: URL,
  request: Transport,
  signal: AbortSignal,
): Promise<FetchResult> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await request(current, signal);

    if (REDIRECT_STATUSES.has(response.status)) {
      response.destroy();
      if (!response.location) return { ok: false, error: "unreachable" };
      let next: URL;
      try {
        next = new URL(response.location, current);
      } catch {
        return { ok: false, error: "invalid-url" };
      }
      // Every hop is validated again: https, port 443, public address (RF-4).
      const checked = parseSourceUrl(next.href);
      if (!checked.ok) return { ok: false, error: "invalid-url" };
      current = checked.url;
      continue;
    }

    if (response.status !== 200) {
      response.destroy();
      return { ok: false, error: "unreachable" };
    }
    const text = await readBody(response);
    return text === null
      ? { ok: false, error: "too-large" }
      : { ok: true, text };
  }
  return { ok: false, error: "unreachable" };
}

/** Downloads the link in `url` (already validated by `parseSourceUrl`). */
export async function fetchIcs(
  url: URL,
  deps: { request?: Transport } = {},
): Promise<FetchResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FetchResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ ok: false, error: "unreachable" });
    }, FETCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      download(url, deps.request ?? httpsTransport, controller.signal).catch(
        (error: unknown): FetchResult => ({
          ok: false,
          error:
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === BLOCKED
              ? "invalid-url"
              : "unreachable",
        }),
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
