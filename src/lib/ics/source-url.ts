import { isIP } from "node:net";
import { isPublicAddress } from "./ip-guard";

export type SourceUrlResult = { ok: true; url: URL } | { ok: false };

/**
 * Validates the link typed by the user (RF-3, RF-4): https only (webcal:// is
 * https://), port 443, no credentials and no private IP written by hand.
 * Names are checked again when the connection is made, because a name can
 * resolve to a private address (plan D6).
 */
export function parseSourceUrl(raw: string): SourceUrlResult {
  const text = raw.trim().replace(/^webcal:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false };
  }

  if (url.protocol !== "https:") return { ok: false };
  if (url.port !== "" && url.port !== "443") return { ok: false };
  if (url.username !== "" || url.password !== "") return { ok: false };
  if (url.hostname === "") return { ok: false };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !isPublicAddress(host)) return { ok: false };

  return { ok: true, url };
}
