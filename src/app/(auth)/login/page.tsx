import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Iniciar sesión"
      footer={{
        text: "¿No tienes cuenta?",
        linkLabel: "Crea una",
        href: "/signup",
      }}
    >
      <LoginForm action={signIn} />
      <Link
        href="/forgot-password"
        className="mt-4 block text-center text-sm font-medium text-accent-ink underline underline-offset-4"
      >
        ¿Olvidaste tu contraseña?
      </Link>
    </AuthCard>
  );
}
