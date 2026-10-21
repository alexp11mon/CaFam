import type { Metadata } from "next";
import { PageShell } from "@/components/calendar/page-shell";
import { JoinCodeForm } from "@/components/sharing/join-code-form";
import { joinWithCode } from "./actions";

export const metadata: Metadata = { title: "Unirme con código" };

export default function JoinPage() {
  return (
    <PageShell title="Unirme con código">
      <p className="text-ink">
        Escribe el ID del calendario y el PIN que te ha dado su propietario.
      </p>
      <JoinCodeForm action={joinWithCode} />
    </PageShell>
  );
}
