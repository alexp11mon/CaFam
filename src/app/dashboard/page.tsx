import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Panel" };

// Reads the session cookies, so it streams behind <Suspense> (cacheComponents).
async function Greeting() {
  // Supabase reads Date.now() to check the session: render per request.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  return <>Hola, {profile?.display_name}</>;
}

// Minimal panel so sign-up and login have a destination; T9 adds the
// calendar list and the responsive layout.
export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">
          <Suspense fallback="Hola">
            <Greeting />
          </Suspense>
        </h1>
        <form action={signOut}>
          <Button type="submit">Cerrar sesión</Button>
        </form>
      </header>
    </main>
  );
}
