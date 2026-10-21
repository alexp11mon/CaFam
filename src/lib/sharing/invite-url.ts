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
  const path = `/invite/${encodeURIComponent(token)}`;
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
