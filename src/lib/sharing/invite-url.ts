function firstValue(value: string | null): string | null {
  return value?.split(",")[0].trim() || null;
}

/**
 * Absolute invite link built from the request origin (plan D11), so it needs no
 * environment variable. Without any host it falls back to the bare path.
 */
export function buildInviteUrl(
  headers: Pick<Headers, "get">,
  token: string,
): string {
  return absoluteUrl(headers, `/invite/${encodeURIComponent(token)}`);
}

/** The .ics subscription link of a token (spec 043 RF-7). */
export function buildFeedUrl(
  headers: Pick<Headers, "get">,
  token: string,
): string {
  return absoluteUrl(headers, `/api/ics/${encodeURIComponent(token)}.ics`);
}

function absoluteUrl(headers: Pick<Headers, "get">, path: string): string {
  const host =
    firstValue(headers.get("x-forwarded-host")) ??
    firstValue(headers.get("host"));
  if (!host) return path;

  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol =
    firstValue(headers.get("x-forwarded-proto")) ??
    (isLocal ? "http" : "https");
  return `${protocol}://${host}${path}`;
}
