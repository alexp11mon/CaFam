import { BUTTON_BASE, BUTTON_VARIANTS } from "@/components/ui/button-styles";
import Link from "next/link";
import { T } from "@/components/i18n/locale-provider";

// The link goes to a Route Handler, so it is a plain <a> styled as LinkButton.
// The same look as every primary action (spec 025 RF-6); an <a> because it
// leaves the app for Google.
const PRIMARY = `${BUTTON_BASE} ${BUTTON_VARIANTS.primary}`;

/** What Google will show before the user goes there (RF-48, plan R6; spec 009 RF-40, R7). */
export function ProviderNotice() {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-paper p-4 text-ink sm:p-6">
      <p>
        <T>{"Google te mostrará el aviso"}</T>{" "}
        <strong>
          <T>{"«Google no ha verificado esta aplicación»"}</T>
        </strong>
        <T>
          {
            ". Es normal: CaFam es una aplicación personal, sin ánimo de lucro, y no ha pasado la verificación de Google, pensada para empresas."
          }
        </T>
      </p>
      <p>
        <T>{"Para seguir, pulsa"}</T>{" "}
        <strong>
          <T>{"«Configuración avanzada»"}</T>
        </strong>{" "}
        <T>{"y después"}</T>{" "}
        <strong>
          <T>{"«Ir a CaFam»"}</T>
        </strong>
        .
      </p>
      <p>
        <T>
          {
            "CaFam pide permiso para ver tus calendarios y, para que lo que hagas en CaFam llegue a Google, para crear, cambiar y borrar sus eventos y para crear calendarios y cambiarles el nombre. Marca todas las casillas: sin ellas, tus calendarios se verán en CaFam pero no se podrán cambiar desde aquí. CaFam nunca borra tus calendarios de Google."
          }
        </T>
      </p>
      <p>
        <Link
          href="/privacy"
          className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
        >
          <T>{"Política de privacidad"}</T>
        </Link>
      </p>
      <a href="/api/oauth/google/start" className={`${PRIMARY} self-start`}>
        <T>{"Continuar a Google"}</T>
      </a>
    </div>
  );
}
