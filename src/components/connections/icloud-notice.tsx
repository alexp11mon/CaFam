import Link from "next/link";
import { T } from "@/components/i18n/locale-provider";

const LINK =
  "font-semibold underline decoration-control underline-offset-4 hover:decoration-ink";

/** What an iCloud connection needs and what it opens (spec 018 RF-2 to RF-4). */
export function IcloudNotice() {
  return (
    <div className="flex flex-col gap-4 rounded-card bg-paper p-4 text-ink sm:p-6">
      <p>
        <T>{"Para conectar iCloud hace falta una"}</T>{" "}
        <strong>
          <T>{"contraseña específica de app"}</T>
        </strong>
        <T>
          {
            ", no la contraseña normal de tu Apple ID. Apple solo deja crearla si tu Apple ID tiene la verificación en dos pasos."
          }
        </T>
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5">
        <li>
          <T>{"Entra en"}</T>{" "}
          <a
            href="https://account.apple.com/"
            target="_blank"
            rel="noreferrer"
            className={LINK}
          >
            <T>{"account.apple.com"}</T>
          </a>{" "}
          <T>{"con tu Apple ID."}</T>
        </li>
        <li>
          <T>
            {
              "En «Inicio de sesión y seguridad», elige «Contraseñas específicas de app»."
            }
          </T>
        </li>
        <li>
          <T>
            {
              "Crea una con un nombre como «CaFam» y copia la contraseña que te muestra, con la forma abcd-efgh-ijkl-mnop."
            }
          </T>
        </li>
        <li>
          <T>{"Escríbela abajo junto a tu Apple ID."}</T>
        </li>
      </ol>
      <p>
        <T>
          {
            "Esa contraseña también da acceso a tu correo y a tus contactos de iCloud, pero CaFam solo usa los calendarios. Puedes revocarla cuando quieras en account.apple.com, y CaFam dejará de tener acceso."
          }
        </T>
      </p>
      <p>
        <Link href="/privacy" className={LINK}>
          <T>{"Política de privacidad"}</T>
        </Link>
      </p>
    </div>
  );
}
