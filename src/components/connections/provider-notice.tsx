// The link goes to a Route Handler, so it is a plain <a> styled as LinkButton.
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** What Google will show before the user goes there (RF-48, plan R6). */
export function ProviderNotice() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-paper p-4 text-ink sm:p-6">
      <p>
        Google te mostrará el aviso{" "}
        <strong>«Google no ha verificado esta aplicación»</strong>. Es normal:
        CaFam es una aplicación personal, sin ánimo de lucro, y no ha pasado la
        verificación de Google, pensada para empresas.
      </p>
      <p>
        Para seguir, pulsa <strong>«Configuración avanzada»</strong> y después{" "}
        <strong>«Ir a CaFam»</strong>. CaFam solo pide permiso para ver tus
        calendarios y sus eventos, nunca para cambiarlos.
      </p>
      <a href="/api/oauth/google/start" className={`${PRIMARY} self-start`}>
        Continuar a Google
      </a>
    </div>
  );
}
