import type { Metadata } from "next";
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
    </AuthCard>
  );
}
