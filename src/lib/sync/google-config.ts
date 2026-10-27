// Google OAuth client from the server environment (constitution P4: never
// NEXT_PUBLIC_). The callback lives on the same origin as the request.
export function googleConfig(origin: string) {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: `${origin}/api/oauth/google/callback`,
  };
}
