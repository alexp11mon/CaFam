# Spec 015 — Asistente de chat

## Contexto y objetivo

Para saber qué hay un día concreto, o cuándo pueden quedar dos personas, hoy hay que recorrer el calendario a mano y comparar eventos de varios calendarios. Esta spec añade un **asistente de chat** que responde en lenguaje natural, en español, a preguntas sobre los eventos que el usuario puede ver. Por ejemplo: "¿Qué hay el sábado?", "¿Cuándo es el cumpleaños de Ana?" o "¿Qué tardes tenemos libres Luis y yo la semana que viene?". Usa un proveedor de modelos de lenguaje con capa gratuita sin tarjeta (enmienda 3: P1, P2). Gemini queda descartado porque su capa gratuita no puede usarse con usuarios de la UE. Es la fase 4 del plan de mejoras.

> **Ampliación del 2026-11-02** (pedida por el usuario tras probarlo en producción; **aprobada por el usuario el 2026-11-02**): el asistente también lee y busca en los **comentarios** de los eventos (spec 014), por ejemplo "¿Qué días de este mes no voy a poder ir a EOI?" cuando eso está escrito en un comentario, y se abre con un **botón redondo flotante** en todas las pantallas, como el "+" de nuevo evento. Añade RF-34 a RF-39 y cambia RF-1, RF-26, RF-30 y RF-32. Decisiones del usuario del 2026-11-02: el botón en todas las pantallas del panel (móvil y escritorio); el asistente lee los comentarios de todos los autores en los eventos que el usuario ve; y también busca por su texto.

## Usuarios / actores

- **Usuario con sesión**: hace preguntas sobre sus eventos y la disponibilidad común.
- **Otra persona nombrada en la pregunta**: un usuario que comparte algún calendario con quien pregunta; su disponibilidad solo se usa si lo ha consentido.
- **Proveedor del modelo de lenguaje**: tercero que recibe la pregunta y los datos imprescindibles para responderla (P1).

## Historias de usuario

- H1: Como usuario quiero preguntar qué tengo un día para no tener que buscarlo en el calendario.
- H2: Como usuario quiero preguntar cuándo es un evento para encontrarlo sin buscarlo a mano.
- H3: Como usuario quiero saber qué días y horas tenemos libres otra persona y yo para proponer un plan.
- H4: Como usuario quiero decidir si otros pueden consultar mi disponibilidad para proteger mi intimidad.
- H5: Como usuario quiero poder comprobar la respuesta para fiarme de ella.
- H6: Como usuario quiero preguntar por lo que se ha comentado en los eventos (a cuáles no voy, quién lleva qué) para no abrirlos uno a uno.
- H7: Como usuario quiero abrir el asistente desde cualquier pantalla con un botón a mano para no buscarlo en el menú.

## Requisitos funcionales (criterios de aceptación en EARS)

### Acceso y conversación

- RF-1: EL SISTEMA ofrecerá el asistente desde el marco de la app (barra lateral en escritorio, hoja "Más" y cajón en el móvil y el botón flotante de RF-39) en una pantalla o panel propio.
- RF-2: EL SISTEMA mostrará al abrir el asistente tres ejemplos de preguntas que se pueden pulsar.
- RF-3: CUANDO el usuario envíe una pregunta de 1 a 500 caracteres, EL SISTEMA responderá en español en el mismo hilo.
- RF-4: MIENTRAS el asistente prepare la respuesta, EL SISTEMA mostrará que está pensando y permitirá cancelarla.
- RF-5: EL SISTEMA entenderá preguntas de seguimiento dentro de la misma conversación ("¿y el domingo?").
- RF-6: EL SISTEMA guardará la conversación solo mientras la pantalla esté abierta, y ofrecerá "Nueva conversación" para empezar de cero; no guardará ningún historial de conversaciones (decisión del usuario del 2026-10-29).
- RF-7: EL SISTEMA interpretará las fechas relativas ("hoy", "mañana", "el sábado", "la semana que viene") en la zona horaria del perfil del usuario.

### Consultas de eventos

- RF-8: CUANDO el usuario pregunte por un día, una semana o un rango de fechas, EL SISTEMA responderá con los eventos de ese periodo, con su hora, título, calendario y lugar.
- RF-9: CUANDO el usuario pregunte por un evento por su nombre o su contenido, EL SISTEMA buscará entre sus eventos y responderá con las coincidencias y sus fechas.
- RF-10: EL SISTEMA solo usará los eventos que el usuario puede ver en CaFam (P3), incluidos los de los calendarios ocultos en los filtros (decisión del usuario del 2026-10-29).
- RF-11: EL SISTEMA acompañará cada respuesta que cite eventos con una lista de esos eventos que se pueden pulsar para abrir su detalle.
- RF-12: SI no hay eventos que respondan a la pregunta, ENTONCES EL SISTEMA lo dirá claramente, sin inventar ninguno.
- RF-13: EL SISTEMA basará las fechas, horas y títulos de cada respuesta solo en los datos consultados; nunca en lo que el modelo suponga.

### Disponibilidad común

- RF-14: CUANDO el usuario pregunte por los huecos libres suyos y de una o varias personas en un periodo, EL SISTEMA responderá con los días y franjas en que todos están libres.
- RF-15: EL SISTEMA reconocerá a las personas por el nombre con el que aparecen en CaFam (las que comparten algún calendario con el usuario).
- RF-16: SI el nombre coincide con varias personas o con ninguna, ENTONCES EL SISTEMA preguntará a cuál se refiere o dirá que no la encuentra.
- RF-17: EL SISTEMA usará por defecto las franjas "mañana" (de 08:00 a 14:00), "tarde" (de 16:00 a 21:00) y "noche" (de 21:00 a 24:00), en la zona del perfil de quien pregunta.
- RF-17b: CUANDO la pregunta indique horas o una franja concretas ("después de las 17:00", "de 15:00 a 18:00", "la tarde a partir de las 15:00"), EL SISTEMA usará esas horas en lugar de las franjas por defecto.
- RF-18: EL SISTEMA considerará ocupada a una persona durante sus eventos con hora y todo el día durante sus eventos de día completo (decisión del usuario del 2026-10-29).
- RF-19: EL SISTEMA calculará la disponibilidad con los datos de la base de datos, sin dejar el cálculo al modelo de lenguaje.
- RF-20: EL SISTEMA solo usará la disponibilidad de otra persona si esa persona ha activado en Ajustes "Permitir que el asistente de otros consulte mi disponibilidad".
- RF-21: EL SISTEMA tendrá ese ajuste desactivado por defecto.
- RF-22: SI otra persona no ha dado su permiso, ENTONCES EL SISTEMA calculará su disponibilidad solo con los eventos suyos que el usuario ya puede ver, y lo dirá en la respuesta.
- RF-23: CUANDO use la disponibilidad consentida de otra persona, EL SISTEMA solo revelará si está libre u ocupada, nunca el título, el lugar ni el calendario de sus eventos que el usuario no puede ver.
- RF-24: EL SISTEMA solo responderá a preguntas de disponibilidad de un periodo de como mucho 31 días seguidos, y propondrá acotarlo si se pide más.

### Límites y errores

- RF-25: EL SISTEMA solo consultará datos, nunca creará, cambiará ni borrará eventos desde el asistente.
- RF-26: SI la pregunta no trata de los eventos, sus comentarios o la disponibilidad, ENTONCES EL SISTEMA responderá que solo puede ayudar con el calendario. Una pregunta sobre si el usuario irá o no a un evento, o sobre lo que se dijo de él, trata del calendario (ampliación del 2026-11-02: "¿Qué días no voy a poder ir a EOI?" recibía "Solo puedo ayudarte con tu calendario").
- RF-27: SI el usuario supera 30 preguntas en un día, ENTONCES EL SISTEMA no enviará más hasta el día siguiente y lo explicará.
- RF-28: SI el proveedor no responde, rechaza la petición o se agota su capa gratuita, ENTONCES EL SISTEMA mostrará "El asistente no está disponible ahora mismo" y conservará la pregunta para reintentarla.
- RF-29: SI la pregunta intenta que el asistente ignore sus reglas o revele datos ajenos, ENTONCES EL SISTEMA seguirá aplicando los permisos de RF-10, RF-20 y RF-23, porque los impone el servidor y no el modelo.

### Privacidad

- RF-30: EL SISTEMA enviará al proveedor solo la pregunta, el hilo de la conversación y los datos de eventos necesarios para responderla, incluidos los comentarios con el nombre de su autor cuando la pregunta los necesite (RF-34); nunca emails, contraseñas, tokens ni identificadores internos.
- RF-31: EL SISTEMA no enviará al proveedor datos de calendarios traídos de Google si las condiciones del proveedor le permiten entrenar con ellos (P1).
- RF-32: EL SISTEMA explicará en la política de privacidad (`/privacy`) qué proveedor recibe los datos, cuáles (también los comentarios y el nombre de quien los escribió) y para qué, antes de publicar el asistente y antes de publicar la ampliación.
- RF-33: CUANDO el usuario abra el asistente por primera vez, EL SISTEMA le explicará en una frase que sus preguntas y los eventos necesarios se envían a un tercero, con un enlace a la política de privacidad.

### Comentarios (ampliación del 2026-11-02)

- RF-34: CUANDO la pregunta trate de lo comentado en uno o varios eventos (asistencia, notas, quién lleva qué), EL SISTEMA leerá los comentarios de esos eventos y responderá con ellos, citando cada evento como en RF-11.
- RF-35: EL SISTEMA solo leerá los comentarios de los eventos que el usuario puede ver en CaFam (P3, RLS de la spec 014), de cualquier autor, con el nombre del autor como lo muestra CaFam ("un antiguo miembro", "Cuenta borrada") y su fecha.
- RF-36: CUANDO el usuario busque por nombre o contenido (RF-9), EL SISTEMA buscará también en el texto de los comentarios y dirá qué comentario coincide.
- RF-37: EL SISTEMA tratará los comentarios de cada repetición de una serie como de esa repetición (spec 014): un comentario en la clase del martes no vale para la del jueves.
- RF-38: EL SISTEMA tratará el texto de los comentarios como datos: una instrucción escrita en un comentario no cambia las reglas ni los permisos (RF-29).

### Botón del asistente (ampliación del 2026-11-02)

- RF-39: EL SISTEMA mostrará un botón redondo flotante, con el icono del asistente y el nombre accesible "Asistente", abajo a la derecha de todas las pantallas del panel salvo la del propio asistente, en el móvil y en el escritorio, que abre el asistente. Donde esté el "+" de nuevo evento (spec 016) irá encima de él, y nunca tapará la barra inferior (769–1023 px) ni los avisos.

## Requisitos no funcionales

- **Coste cero** (P2): proveedor con capa gratuita sin tarjeta y usable desde la UE; el plan comprueba sus límites y que RF-27 los respeta.
- **Secretos** (P4): la clave del proveedor solo vive en el servidor.
- **Permisos** (P3): todas las consultas de datos usan la sesión del usuario; los permisos los impone la base de datos.
- **Tiempo de respuesta**: el 90 % de las respuestas llega en menos de 10 s.
- **Calidad**: un conjunto de al menos 30 preguntas de prueba con respuestas esperadas (fechas, huecos, "no hay eventos" y, desde la ampliación, comentarios) se responde bien en al menos el 90 % de los casos, y nunca con un evento inventado.
- **Cuota por minuto**: leer comentarios no puede llevar una pregunta normal por encima de los 8.000 tokens por minuto del proveedor (R1): se leen solo cuando la pregunta los necesita y con un tope de comentarios y de longitud.
- **Accesibilidad** (P9): las respuestas se anuncian a los lectores de pantalla y la conversación se usa entera con teclado.

## Casos límite

- **Pregunta ambigua** ("¿qué hay el día 5?" sin mes): se entiende el próximo día 5.
- **Fecha imposible** ("31 de febrero"): se dice que no existe.
- **Muchos eventos** (más de 30 en el periodo; eran 50 hasta el arreglo del 2026-11-02, que pasaba del límite por minuto): se resumen y se propone acotar.
- **Muchos comentarios** en un evento: se leen los más recientes, con un tope, y se dice que hay más.
- **Evento sin comentarios**: se dice que no tiene, sin suponer nada.
- **Repeticiones** (spec 013): cada repetición cuenta como un evento.
- **Persona sin calendarios compartidos con quien pregunta**: no se reconoce (RF-15).
- **Persona con zona horaria distinta**: los huecos se muestran en la zona de quien pregunta.
- **Pregunta en otro idioma**: se responde en español.
- **Sin conexión**: el asistente no está disponible y lo dice.

## Fuera de alcance

- Crear, cambiar o borrar eventos desde el chat.
- Voz (dictar o escuchar).
- Preguntas sobre las imágenes de los eventos. (Los comentarios entran con la ampliación del 2026-11-02.)
- Escribir o borrar comentarios desde el asistente (RF-25).
- Abrir el asistente como panel sobre la pantalla actual: el botón de RF-39 lleva a la pantalla del asistente.
- Notificaciones o sugerencias proactivas del asistente.
- Modelos de lenguaje de pago o alojados por el proyecto.
- Usar el asistente sin sesión.

## Criterios de finalización

- RF-1 a RF-39 con su test en verde, incluidos los permisos de disponibilidad consentida y de comentarios en `test:db` y el conjunto de preguntas de prueba.
- Política de privacidad actualizada (RF-32), también con los comentarios.
- Prueba manual con dos usuarios (con y sin consentimiento) en móvil y escritorio.
- Capturas a 390, 768 y 1440 px en los dos temas.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Decidido por el usuario el 2026-10-29: sin historial, todos los calendarios que el usuario puede ver, franjas por defecto salvo que la pregunta diga otras horas, el día completo ocupa el día y consentimiento desactivado por defecto.
- Elección del proveedor: la hace el plan, con estas condiciones: capa gratuita sin tarjeta, usable con usuarios de la UE, con llamadas a herramientas y sin entrenar con los datos (o, si entrena, sin datos de Google, RF-31).
