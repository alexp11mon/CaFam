import { createHash, randomBytes } from "node:crypto";

// OAuth state and PKCE verifier, kept in an httpOnly cookie for 10 minutes
// between /start and /callback (plan D10; RF-1, RF-4, RF-5).

const COOKIE = "cafam_oauth";
const ATTRIBUTES = "Path=/api/oauth; HttpOnly; Secure; SameSite=Lax";

export interface OAuthState {
  state: string;
  verifier: string;
}

export function createOAuthState(): OAuthState & { challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return {
    state: randomBytes(32).toString("base64url"),
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function stateCookie({ state, verifier }: OAuthState): string {
  return `${COOKIE}=${state}.${verifier}; ${ATTRIBUTES}; Max-Age=600`;
}

export const CLEAR_STATE_COOKIE = `${COOKIE}=; ${ATTRIBUTES}; Max-Age=0`;

/** The stored pair, or null if the cookie is missing or malformed. */
export function readStateCookie(
  cookieHeader: string | null,
): OAuthState | null {
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  const [state, verifier] = value?.split(".") ?? [];
  return state && verifier ? { state, verifier } : null;
}
