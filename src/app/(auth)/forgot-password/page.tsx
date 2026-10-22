import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";
import { AuthCard } from "@/components/auth/auth-card";
import { requestRecovery } from "./actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

// Reads the query string, so it streams behind <Suspense> (cacheComponents).
async function RecoveryForm({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <ForgotPasswordForm action={requestRecovery} expired={expired === "1"} />
  );
}

/** Recuperar contraseña: asks for the address and sends a link (spec 006, RF-1). */
export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  return (
    <AuthCard
      title="Recuperar contraseña"
      footer={{
        text: "¿Te acordaste?",
        linkLabel: "Inicia sesión",
        href: "/login",
      }}
    >
      <Suspense fallback={null}>
        <RecoveryForm searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
