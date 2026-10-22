import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";

// The guard allows "/" with a session (T6), so the page itself sends signed-in
// users to their panel (plan "Rutas"). It reads cookies, so it streams.
async function RedirectIfSignedIn() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard/calendar");
  return null;
}

export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <div className="flex w-full max-w-md flex-col gap-8 text-center">
        <div className="flex flex-col gap-3">
          <span className="self-center">
            <Logo />
          </span>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-ink sm:text-4xl">
            El calendario de tu familia, en un solo sitio
          </h1>
          <p className="text-lg text-muted">
            Organiza tus planes y compártelos con quien tú elijas.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <LinkButton href="/signup">Crear cuenta</LinkButton>
          <LinkButton href="/login" variant="secondary">
            Iniciar sesión
          </LinkButton>
        </div>
        <IosInstallHint />
      </div>
    </main>
  );
}
