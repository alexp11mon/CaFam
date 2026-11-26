import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { T } from "@/components/i18n/locale-provider";

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
      <h2 className="text-lg font-semibold text-ink">
        <T>{title}</T>
      </h2>
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
      <Link href="/" aria-labelledby="privacy-home" className="self-start">
        <span id="privacy-home" hidden>
          <T>{"CaFam, inicio"}</T>
        </span>
        <Logo />
      </Link>
      <article className="flex flex-col gap-6 rounded-card bg-paper p-4 text-ink sm:p-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl leading-tight font-bold tracking-tight">
            <T>{"Política de privacidad"}</T>
          </h1>
          <p className="text-sm text-muted">
            <T vars={{ UPDATED }}>{"Última actualización: {UPDATED}"}</T>
          </p>
        </header>

        <p>
          <T>
            {
              "CaFam es un calendario compartido para uso personal entre familia y amigos, sin ánimo de lucro, sin publicidad y sin analítica. Esta página explica qué hace CaFam con los datos de tu cuenta de Google si decides conectarla."
            }
          </T>
        </p>

        <Section title="Entrar con Google">
          <p>
            <T>
              {
                "Si usas «Continuar con Google», Google le dice a CaFam tu nombre, tu correo y que la cuenta es tuya (permisos"
              }
            </T>{" "}
            <i>
              <T>{"openid"}</T>
            </i>
            ,{" "}
            <i>
              <T>{"email"}</T>
            </i>{" "}
            <T>{"y"}</T>{" "}
            <i>
              <T>{"profile"}</T>
            </i>
            <T>
              {
                "). CaFam guarda el nombre como el de tu perfil y entra con ese correo; la foto de tu cuenta de Google no se guarda."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Entrar con Google no da acceso a tu Google Calendar: eso solo pasa si además conectas la cuenta en «Cuentas conectadas», con los permisos que se explican abajo."
              }
            </T>
          </p>
        </Section>

        <Section title="Qué datos de Google lee CaFam">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <T>
                {
                  "El correo y el identificador de tu cuenta de Google, para saber qué cuenta has conectado."
                }
              </T>
            </li>
            <li>
              <T>
                {
                  "La lista de tus calendarios (nombre, color y si puedes cambiarlos), para que elijas cuáles traer."
                }
              </T>
            </li>
            <li>
              <T>
                {
                  "De los calendarios que eliges, sus eventos desde 6 meses antes de hoy hasta 1 año después: título, inicio, fin, si es de día completo, descripción y lugar."
                }
              </T>
            </li>
          </ul>
          <p>
            <T>
              {
                "CaFam no lee tus contactos, tu correo ni los invitados, recordatorios, videollamadas o adjuntos de los eventos."
              }
            </T>
          </p>
        </Section>

        <Section title="Qué escribe CaFam en Google">
          <p>
            <T>
              {"Solo lo que tú o un Editor de ese calendario hacéis en CaFam:"}
            </T>
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <T>
                {
                  "Crear, cambiar, mover entre calendarios de la misma cuenta y borrar eventos de los calendarios traídos."
                }
              </T>
            </li>
            <li>
              <T>{"Cambiar el nombre de un calendario traído."}</T>
            </li>
            <li>
              <T>
                {
                  "Crear un calendario nuevo en tu cuenta o subir uno de CaFam a ella."
                }
              </T>
            </li>
          </ul>
          <p>
            <T>
              {
                "CaFam nunca borra calendarios de tu cuenta de Google, salvo el que acaba de crear si la subida falla a medias."
              }
            </T>
          </p>
        </Section>

        <Section title="Para qué se usan">
          <p>
            <T>
              {
                "Solo para mostrar y mantener al día esos calendarios en CaFam y para llevar a Google los cambios que hagas. No se venden, no se usan para publicidad ni para entrenar modelos y no se analizan."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "El uso que hace CaFam de la información recibida de las API de Google cumple la"
              }
            </T>{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
            >
              <T>
                {
                  "Política de datos de usuario de los servicios de API de Google"
                }
              </T>
            </a>
            <T>{", incluidos los requisitos de uso limitado."}</T>
          </p>
        </Section>

        <Section title="Dónde se guardan">
          <p>
            <T>
              {
                "En la base de datos de CaFam (Supabase, en Irlanda), protegida para que cada persona solo vea sus propios datos y los calendarios que comparte. La autorización de Google se guarda cifrada y solo la usa el servidor: nunca llega a tu navegador ni al de otras personas. La aplicación funciona en Vercel, también en Irlanda."
              }
            </T>
          </p>
        </Section>

        <Section title="Con quién se comparten">
          <p>
            <T>
              {
                "Con nadie fuera de CaFam. Dentro de CaFam, los eventos de un calendario traído los ven las personas con las que tú compartes ese calendario, como cualquier otro. El correo de tu cuenta de Google solo lo ves tú. Si un Editor cambia un evento, el cambio se hace con tu cuenta, pero eso no le da acceso a tu cuenta ni a tus otros calendarios."
              }
            </T>
          </p>
        </Section>

        <Section title="Cómo retirar el permiso y borrar los datos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <T>
                {
                  "En CaFam, en «Cuentas conectadas», pulsa «Desconectar»: CaFam retira su permiso en Google y te deja borrar los calendarios traídos o conservarlos como calendarios normales."
                }
              </T>
            </li>
            <li>
              <T>{"También puedes retirarlo desde tu cuenta de Google, en"}</T>{" "}
              <a
                href="https://myaccount.google.com/connections"
                className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
              >
                <T>{"Terceros con acceso a tu cuenta"}</T>
              </a>
              .
            </li>
            <li>
              <T>
                {
                  "Al borrar tu cuenta de CaFam (en «Ajustes») se borran tus datos y tus calendarios, salvo los que compartes, que siguen las reglas de cuentas borradas que explica CaFam antes de confirmar."
                }
              </T>
            </li>
          </ul>
        </Section>

        <Section title="Calendarios de iCloud">
          <p>
            <T>
              {
                "Si conectas una cuenta de iCloud, CaFam hace con sus calendarios lo mismo que con Google: lee los que eliges (nombre, color y eventos desde 6 meses antes de hoy hasta 1 año después) y escribe en ellos solo lo que tú o un Editor hacéis en CaFam. Nunca borra calendarios de iCloud, salvo el que acaba de crear si una subida falla a medias."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Para eso usa tu Apple ID y una contraseña específica de app que creas tú. Esa contraseña también da acceso a tu correo y a tus contactos de iCloud, pero CaFam solo la usa para los calendarios y habla solo con los servidores de Apple."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "La contraseña se guarda cifrada en la base de datos de CaFam y solo la usa el servidor: nunca llega a tu navegador ni al de otras personas, y nadie puede volver a verla. Al desconectar la cuenta se borra."
              }
            </T>
          </p>
          <p>
            <T>{"CaFam no puede revocarla por ti: hazlo cuando quieras en"}</T>{" "}
            <a
              href="https://account.apple.com/"
              className="font-semibold underline decoration-control underline-offset-4 hover:decoration-ink"
            >
              <T>{"account.apple.com"}</T>
            </a>
            <T>
              {
                ", en «Contraseñas específicas de app». Cambiar la contraseña de tu Apple ID también las revoca todas."
              }
            </T>
          </p>
        </Section>

        <Section title="Disponibilidad en el calendario">
          <p>
            <T>
              {
                "Si lo activas en Ajustes, las personas con las que compartes algún calendario pueden elegir ver en su semana y su día cuándo estás ocupado. De cada uno de tus eventos solo reciben el inicio y el fin, como un bloque «Ocupado» con tu nombre: nunca el título, el lugar, la descripción ni el calendario."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Cuentan los eventos de tus calendarios, también los traídos de Google o iCloud, y los que tú creas en calendarios compartidos. Está desactivado por defecto, es independiente del permiso del asistente y, si lo desactivas, los demás dejan de verlo en cuanto vuelven a cargar su calendario."
              }
            </T>
          </p>
        </Section>

        <Section title="Asistente de chat">
          <p>
            <T>
              {
                "Lo que preguntas al asistente de CaFam lo responde Groq (Groq, Inc., en Estados Unidos), un servicio de modelos de lenguaje."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Para cada pregunta, Groq recibe tu pregunta, la conversación y los datos de los eventos necesarios para responderla (título, fechas, lugar y nombre del calendario) de los calendarios que puedes ver y, cuando la pregunta lo necesita, los comentarios de esos eventos, con el nombre de quien los escribió. Nunca recibe tu email, tus contraseñas ni identificadores de CaFam, de Google o de iCloud."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Los usa solo para escribir la respuesta: no los usa para entrenar sus modelos y CaFam tiene activada la retención cero, así que Groq no los guarda después de responder. Los datos salen de la Unión Europea con las cláusulas contractuales tipo que ofrece Groq."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Por defecto, CaFam no guarda la conversación: se pierde al salir de la pantalla o empezar una nueva. Solo anota la hora de cada pregunta para el límite diario, y la borra a los dos días."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Si activas «Guardar conversaciones» en el menú del chat, CaFam guarda en su base de datos el texto de tus conversaciones con el asistente, sin las imágenes, para que puedas retomarlas. Solo las ves tú; se guardan como mucho las 50 últimas y cada una se borra a los 90 días, cuando la borras tú, al desactivar la opción si eliges borrarlas y al borrar tu cuenta."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "El asistente puede decirte cuándo está libre otra persona que comparte calendarios contigo solo si esa persona lo ha permitido en Ajustes, y aun así solo sabe si está libre u ocupada, nunca qué eventos tiene."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Si se lo pides, el asistente crea eventos y te propone cambios en los que ya tienes, con tus mismos permisos: solo donde tú podrías crearlos o cambiarlos y, en los calendarios de Google o iCloud, escribiendo primero en ellos. Los eventos que crea aparecen en la conversación con la opción de deshacerlos. Un cambio, un borrado o un evento que se repite no se guarda hasta que pulsas «Confirmar», «Borrar» o «Crear»; lo que borra va a la papelera y se puede deshacer. Nunca crea, cambia ni borra nada por lo que diga el texto de un evento, un comentario o una imagen."
              }
            </T>
          </p>
        </Section>

        <Section title="Voz en el asistente">
          <p>
            <T>
              {
                "Si tu navegador lo permite, puedes dictar las preguntas con el micrófono. El reconocimiento de voz lo hace el propio navegador: algunos envían el audio a un servicio de su fabricante para pasarlo a texto (Google en Chrome, Apple en Safari), con sus propias condiciones. CaFam nunca recibe el audio, solo el texto que envías."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "«Leer respuestas en voz alta» usa las voces del navegador o del sistema. Está desactivado por defecto y la elección se recuerda solo en ese dispositivo."
              }
            </T>
          </p>
        </Section>

        <Section title="Imágenes en el asistente">
          <p>
            <T>
              {
                "Si adjuntas una imagen al asistente (por ejemplo, tu horario de trabajo), tu navegador la reduce y se envían a Groq solo para leer los eventos que contiene, con las mismas condiciones que el resto de la conversación: no las usa para entrenar y no las guarda."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "CaFam no guarda las imágenes en ningún sitio: viajan con tu mensaje y desaparecen al responder. Ningún evento se crea hasta que revisas la propuesta y pulsas «Crear»."
              }
            </T>
          </p>
        </Section>

        <Section title="Notas">
          <p>
            <T>
              {
                "Las notas que escribes (su título, su texto, los elementos de sus listas, su color y su fecha límite) se guardan en la base de datos de CaFam, igual que tus eventos. Por defecto una nota es personal y solo la ves tú."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Si vinculas una nota a un calendario, la ven todos sus miembros; el propietario y los editores pueden cambiarla y los lectores solo leerla. Si sales de ese calendario, la nota se queda en él y dejas de verla. Al borrar tu cuenta se borran tus notas personales; las compartidas se quedan en su calendario, sin tu nombre."
              }
            </T>
          </p>
          <p>
            <T>
              {"Las notas no se envían a Google, a iCloud ni al asistente."}
            </T>
          </p>
        </Section>

        <Section title="Datos guardados en este dispositivo">
          <p>
            <T>
              {
                "Para que puedas usar CaFam sin conexión, el navegador guarda en tu dispositivo una copia de tus datos: tu perfil (nombre, zona horaria, color y tema), los calendarios que ves con sus categorías y grupos, los eventos desde un mes atrás hasta tres meses adelante y tus notas, los comentarios de esos eventos y las miniaturas de sus imágenes, además de las imágenes grandes que hayas abierto (como mucho 30). También guarda lo que haces sin conexión hasta que llega al servidor, incluidas las imágenes que añades."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Si el navegador borra los datos del sitio antes de que vuelva la conexión, las imágenes pendientes de enviar se pierden. Lo pendiente se puede enviar con la app cerrada en los navegadores que lo permiten."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "No se guardan conversaciones del asistente, los bloques «Ocupado» de otras personas, los emails de otros miembros ni las credenciales de las cuentas conectadas."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "La copia se renueva cada vez que abres CaFam con conexión y como mucho cada 15 minutos mientras la usas. Se borra entera al cerrar sesión, al borrar tu cuenta y cuando otra cuenta inicia sesión en el mismo navegador. También puedes borrarla desde el navegador, borrando los datos del sitio."
              }
            </T>
          </p>
        </Section>

        <Section title="Notificaciones">
          <p>
            <T>
              {
                "Si activas los avisos en un dispositivo, CaFam guarda la dirección que te da el servicio de avisos de tu navegador (Google, Apple, Microsoft o Mozilla), sus claves y el nombre del dispositivo («Chrome en Windows»). Puedes quitar cada dispositivo en Ajustes, y al cerrar sesión se quita el del dispositivo en el que estás."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Cada aviso viaja cifrado de extremo a extremo: el servicio de avisos del navegador lo entrega, pero no puede leer su contenido (el título, la hora y el lugar del evento, o quién comentó y qué)."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "Tus recordatorios son solo tuyos: los demás miembros no los ven. Se guarda cuándo se envió cada recordatorio, para no repetirlo, durante 8 días. Los avisos de lo que hacen otras personas se borran como mucho 2 días después. Al borrar tu cuenta se borra todo."
              }
            </T>
          </p>
        </Section>

        <Section title="Exportar y suscripción (.ics)">
          <p>
            <T>
              {
                "Cualquier miembro de un calendario puede descargar sus eventos en un archivo .ics (título, fechas, descripción, lugar y repetición). El archivo no lleva imágenes, comentarios, colores, categorías ni autores, y CaFam no guarda ninguna copia de lo que descargas."
              }
            </T>
          </p>
          <p>
            <T>
              {
                "El propietario puede crear un enlace secreto de suscripción para ver el calendario en otra app, como Google Calendar, Apple Calendar u Outlook. Cualquiera que tenga el enlace ve los eventos desde seis meses atrás sin necesidad de cuenta, así que solo debe compartirse con quien se quiera. CaFam guarda solo una huella del enlace, no el enlace, y deja de funcionar al desactivarlo, al crear uno nuevo, al borrar el calendario o cuando se queda sin propietario."
              }
            </T>
          </p>
        </Section>

        <Section title="Contacto">
          <p>
            <T>
              {
                "Para cualquier duda, escribe al correo de asistencia que muestra Google en la pantalla de permisos de CaFam."
              }
            </T>
          </p>
        </Section>
      </article>
    </main>
  );
}
