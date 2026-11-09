import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Política de privacidad" };

const UPDATED = "2 de noviembre de 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Public privacy policy: what CaFam reads and writes in Google, why, where it
 * lives, who sees it and how to withdraw it (spec 009 RF-39, plan D16).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <Link href="/" aria-label="CaFam, inicio" className="self-start">
        <Logo />
      </Link>
      <article className="flex flex-col gap-6 rounded-3xl bg-paper p-4 text-ink sm:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            Política de privacidad
          </h1>
          <p className="text-sm text-muted">Última actualización: {UPDATED}</p>
        </header>

        <p>
          CaFam es un calendario compartido para uso personal entre familia y
          amigos, sin ánimo de lucro, sin publicidad y sin analítica. Esta
          página explica qué hace CaFam con los datos de tu cuenta de Google si
          decides conectarla.
        </p>

        <Section title="Qué datos de Google lee CaFam">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              El correo y el identificador de tu cuenta de Google, para saber
              qué cuenta has conectado.
            </li>
            <li>
              La lista de tus calendarios (nombre, color y si puedes
              cambiarlos), para que elijas cuáles traer.
            </li>
            <li>
              De los calendarios que eliges, sus eventos desde 6 meses antes de
              hoy hasta 1 año después: título, inicio, fin, si es de día
              completo, descripción y lugar.
            </li>
          </ul>
          <p>
            CaFam no lee tus contactos, tu correo ni los invitados,
            recordatorios, videollamadas o adjuntos de los eventos.
          </p>
        </Section>

        <Section title="Qué escribe CaFam en Google">
          <p>Solo lo que tú o un Editor de ese calendario hacéis en CaFam:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Crear, cambiar, mover entre calendarios de la misma cuenta y
              borrar eventos de los calendarios traídos.
            </li>
            <li>Cambiar el nombre de un calendario traído.</li>
            <li>
              Crear un calendario nuevo en tu cuenta o subir uno de CaFam a
              ella.
            </li>
          </ul>
          <p>
            CaFam nunca borra calendarios de tu cuenta de Google, salvo el que
            acaba de crear si la subida falla a medias.
          </p>
        </Section>

        <Section title="Para qué se usan">
          <p>
            Solo para mostrar y mantener al día esos calendarios en CaFam y para
            llevar a Google los cambios que hagas. No se venden, no se usan para
            publicidad ni para entrenar modelos y no se analizan.
          </p>
          <p>
            El uso que hace CaFam de la información recibida de las API de
            Google cumple la{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
            >
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de uso limitado.
          </p>
        </Section>

        <Section title="Dónde se guardan">
          <p>
            En la base de datos de CaFam (Supabase, en Irlanda), protegida para
            que cada persona solo vea sus propios datos y los calendarios que
            comparte. La autorización de Google se guarda cifrada y solo la usa
            el servidor: nunca llega a tu navegador ni al de otras personas. La
            aplicación funciona en Vercel, también en Irlanda.
          </p>
        </Section>

        <Section title="Con quién se comparten">
          <p>
            Con nadie fuera de CaFam. Dentro de CaFam, los eventos de un
            calendario traído los ven las personas con las que tú compartes ese
            calendario, como cualquier otro. El correo de tu cuenta de Google
            solo lo ves tú. Si un Editor cambia un evento, el cambio se hace con
            tu cuenta, pero eso no le da acceso a tu cuenta ni a tus otros
            calendarios.
          </p>
        </Section>

        <Section title="Cómo retirar el permiso y borrar los datos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              En CaFam, en «Cuentas conectadas», pulsa «Desconectar»: CaFam
              retira su permiso en Google y te deja borrar los calendarios
              traídos o conservarlos como calendarios normales.
            </li>
            <li>
              También puedes retirarlo desde tu cuenta de Google, en{" "}
              <a
                href="https://myaccount.google.com/connections"
                className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
              >
                Terceros con acceso a tu cuenta
              </a>
              .
            </li>
            <li>
              Al borrar tu cuenta de CaFam (en «Ajustes») se borran tus datos y
              tus calendarios, salvo los que compartes, que siguen las reglas de
              cuentas borradas que explica CaFam antes de confirmar.
            </li>
          </ul>
        </Section>

        <Section title="Calendarios de iCloud">
          <p>
            Si conectas una cuenta de iCloud, CaFam hace con sus calendarios lo
            mismo que con Google: lee los que eliges (nombre, color y eventos
            desde 6 meses antes de hoy hasta 1 año después) y escribe en ellos
            solo lo que tú o un Editor hacéis en CaFam. Nunca borra calendarios
            de iCloud, salvo el que acaba de crear si una subida falla a medias.
          </p>
          <p>
            Para eso usa tu Apple ID y una contraseña específica de app que
            creas tú. Esa contraseña también da acceso a tu correo y a tus
            contactos de iCloud, pero CaFam solo la usa para los calendarios y
            habla solo con los servidores de Apple.
          </p>
          <p>
            La contraseña se guarda cifrada en la base de datos de CaFam y solo
            la usa el servidor: nunca llega a tu navegador ni al de otras
            personas, y nadie puede volver a verla. Al desconectar la cuenta se
            borra.
          </p>
          <p>
            CaFam no puede revocarla por ti: hazlo cuando quieras en{" "}
            <a
              href="https://account.apple.com/"
              className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
            >
              account.apple.com
            </a>
            , en «Contraseñas específicas de app». Cambiar la contraseña de tu
            Apple ID también las revoca todas.
          </p>
        </Section>

        <Section title="Disponibilidad en el calendario">
          <p>
            Si lo activas en Ajustes, las personas con las que compartes algún
            calendario pueden elegir ver en su semana y su día cuándo estás
            ocupado. De cada uno de tus eventos solo reciben el inicio y el fin,
            como un bloque «Ocupado» con tu nombre: nunca el título, el lugar,
            la descripción ni el calendario.
          </p>
          <p>
            Cuentan los eventos de tus calendarios, también los traídos de
            Google o iCloud, y los que tú creas en calendarios compartidos. Está
            desactivado por defecto, es independiente del permiso del asistente
            y, si lo desactivas, los demás dejan de verlo en cuanto vuelven a
            cargar su calendario.
          </p>
        </Section>

        <Section title="Asistente de chat">
          <p>
            Lo que preguntas al asistente de CaFam lo responde Groq (Groq, Inc.,
            en Estados Unidos), un servicio de modelos de lenguaje.
          </p>
          <p>
            Para cada pregunta, Groq recibe tu pregunta, la conversación y los
            datos de los eventos necesarios para responderla (título, fechas,
            lugar y nombre del calendario) de los calendarios que puedes ver y,
            cuando la pregunta lo necesita, los comentarios de esos eventos, con
            el nombre de quien los escribió. Nunca recibe tu email, tus
            contraseñas ni identificadores de CaFam, de Google o de iCloud.
          </p>
          <p>
            Los usa solo para escribir la respuesta: no los usa para entrenar
            sus modelos y CaFam tiene activada la retención cero, así que Groq
            no los guarda después de responder. Los datos salen de la Unión
            Europea con las cláusulas contractuales tipo que ofrece Groq.
          </p>
          <p>
            CaFam no guarda la conversación: se pierde al salir de la pantalla o
            empezar una nueva. Solo anota la hora de cada pregunta para el
            límite diario, y la borra a los dos días.
          </p>
          <p>
            El asistente puede decirte cuándo está libre otra persona que
            comparte calendarios contigo solo si esa persona lo ha permitido en
            Ajustes, y aun así solo sabe si está libre u ocupada, nunca qué
            eventos tiene.
          </p>
        </Section>

        <Section title="Imágenes en el asistente">
          <p>
            Si adjuntas una imagen al asistente (por ejemplo, tu horario de
            trabajo), tu navegador la reduce y se envían a Groq solo para leer
            los eventos que contiene, con las mismas condiciones que el resto de
            la conversación: no las usa para entrenar y no las guarda.
          </p>
          <p>
            CaFam no guarda las imágenes en ningún sitio: viajan con tu mensaje
            y desaparecen al responder. Ningún evento se crea hasta que revisas
            la propuesta y pulsas «Crear».
          </p>
        </Section>

        <Section title="Contacto">
          <p>
            Para cualquier duda, escribe al correo de asistencia que muestra
            Google en la pantalla de permisos de CaFam.
          </p>
        </Section>
      </article>
    </main>
  );
}
