import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { IosInstallHint } from "@/components/pwa/ios-install-hint";
import { Logo } from "@/components/brand/logo";
import { Venito } from "@/components/brand/venito";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/server";
import { T } from "@/components/i18n/locale-provider";

// The guard allows "/" with a session (T6), so the page itself sends signed-in
// users to their panel (plan "Rutas"). It reads cookies, so it streams.
async function RedirectIfSignedIn() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");
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
          {/* Venito says hello: the mascot is part of the brand (spec 027). */}
          <Venito mood="wave" className="size-32 self-center" />
          <h1 className="text-3xl leading-tight font-bold tracking-tight text-ink sm:text-4xl">
            <T>{"El calendario de tu familia, en un solo sitio"}</T>
          </h1>
          <p className="text-lg text-muted">
            <T>{"Organiza tus planes y compártelos con quien tú elijas."}</T>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <LinkButton href="/signup">
            <T>{"Crear cuenta"}</T>
          </LinkButton>
          <LinkButton href="/login" variant="secondary">
            <T>{"Iniciar sesión"}</T>
          </LinkButton>
        </div>
        <IosInstallHint />
        {/* Google asks for it before connecting an account (spec 009 RF-40). */}
        <Link
          href="/privacy"
          className="self-center text-sm text-muted underline decoration-control underline-offset-4 hover:text-ink"
        >
          <T>{"Política de privacidad"}</T>
        </Link>
      </div>
    </main>
  );
}
