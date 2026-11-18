import { applyWithSession } from "@/app/dashboard/offline-session";

// Spec 035 plan D5: the service worker replays one change made offline with
// the same contract as the Server Action, which it cannot call (its id
// changes with every deployment). Without a session, 401 (RF-44).
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const { change, force } =
    typeof body === "object" && body !== null
      ? (body as { change?: unknown; force?: unknown })
      : {};
  const result = await applyWithSession(change, force === true);
  if ("unauthenticated" in result) {
    return Response.json(result, { status: 401 });
  }
  return Response.json(result);
}
