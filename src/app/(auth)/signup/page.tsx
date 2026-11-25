import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { signUp } from "../actions";
import { signInWithGoogle } from "../oauth-actions";

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
      <GoogleButton action={signInWithGoogle} />
      <SignupForm action={signUp} />
    </AuthCard>
  );
}
