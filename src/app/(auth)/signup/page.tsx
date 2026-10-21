import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Crear cuenta"
      footer={{
        text: "¿Ya tienes cuenta?",
        linkLabel: "Inicia sesión",
        href: "/login",
      }}
    >
      <SignupForm action={signUp} />
    </AuthCard>
  );
}
