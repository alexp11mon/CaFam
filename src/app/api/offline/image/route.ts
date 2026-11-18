import { revalidatePath } from "next/cache";
import { imageOpSchema, offlineImage } from "@/app/dashboard/offline-images";
import { offlineSession } from "@/app/dashboard/offline-session";

// Spec 035 plan D5, D6: reserving and confirming an image added offline, for
// the app and the service worker. The bytes go straight to Storage with the
// signed URLs; RLS and the limits of always decide (RF-39 to RF-41).
export async function POST(request: Request) {
  const current = await offlineSession();
  if (!current)
    return Response.json({ unauthenticated: true }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const op = imageOpSchema.safeParse(body);
  if (!op.success) {
    return Response.json({ error: "Petición no válida." }, { status: 400 });
  }
  try {
    const answer = await offlineImage(current.supabase, op.data);
    // The detail and the image marks of the views (spec 012 RF-12).
    if (op.data.op === "confirm" && answer.status === 200) {
      revalidatePath("/dashboard", "layout");
    }
    return Response.json(answer.body, { status: answer.status });
  } catch {
    // The network or Supabase failed: the client tries again later.
    return Response.json({ error: "retry" }, { status: 503 });
  }
}
