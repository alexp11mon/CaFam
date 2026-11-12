import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ui/error-screen";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = { title: "Página no encontrada" };

/** Any address that does not exist and every `notFound()` (spec 023 RF-16). */
export default function NotFound() {
  return (
    <ErrorScreen
      title="No encontramos esta página"
      text="Puede que el enlace esté mal, que ya no exista o que no tengas acceso."
    >
      <LinkButton href="/dashboard/calendar">Ir al calendario</LinkButton>
    </ErrorScreen>
  );
}
