import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { CheckEmail } from "@/components/auth/check-email";
import { resendConfirmation } from "../../actions";

export const metadata: Metadata = { title: "Revisa tu correo" };

type Search = Promise<{ email?: string; expired?: string }>;

// Reads the query string, so it streams behind <Suspense> (cacheComponents).
async function Content({ searchParams }: { searchParams: Search }) {
  const { email, expired } = await searchParams;
  // Only the masked address travels in the URL (spec 049 RF-1).
  const shown = email && /^.\*\*\*@[^\s@]+$/.test(email) ? email : null;
  return (
    <CheckEmail
      email={shown}
      expired={expired === "1"}
      action={resendConfirmation}
    />
  );
}

/** The account waits for the link of its email (spec 049 RF-1, RF-2). */
export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  return (
    <AuthCard
      title="Revisa tu correo"
      footer={{
        text: "¿Ya lo confirmaste?",
        linkLabel: "Inicia sesión",
        href: "/login",
      }}
    >
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
