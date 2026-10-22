import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { AuthCard } from "@/components/auth/auth-card";
import { resetPassword } from "./actions";

export const metadata: Metadata = { title: "Nueva contraseña" };

/** Reached from the recovery link; the session it creates is what lets it save (spec 006, RF-2). */
export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Nueva contraseña"
      footer={{
        text: "¿El enlace ha caducado?",
        linkLabel: "Pide otro",
        href: "/forgot-password",
      }}
    >
      <ResetPasswordForm action={resetPassword} />
    </AuthCard>
  );
}
