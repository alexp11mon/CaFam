# Spec 004 — Importación de calendarios .ics

> Estado: **Aprobada** por el usuario (2026-10-22), con estas decisiones: se actualizan `docs/constitution.md` y `AGENTS.md`; un evento con zona horaria no reconocida se omite; y el límite baja a 2 MB y 2.000 eventos para que la importación quepa en la capa gratuita. Constitución: `docs/constitution.md`. Parte de las specs 001, 002 y 003 (cerradas).
> Esta spec **cambia el alcance** que el roadmap daba a la 004 (suscripción de solo lectura): ahora es una importación única que crea un calendario propio, editable y compartible. La constitución y `AGENTS.md` se actualizan en el mismo cambio.

## Contexto y objetivo

Mucha gente ya tiene sus eventos en Google Calendar, iCloud u Outlook. Esta spec permite traerlos a CalenderFam: la persona indica un enlace `.ics` o sube un archivo `.ics`, el sistema lo lee una sola vez y crea un **calendario nuevo** con esos eventos. A partir de ahí es un calendario como cualquier otro de la aplicación: se puede editar, añadirle eventos, compartir con roles Lector/Editor (spec 003) y juntar con otros (spec 002), y no vuelve a depender de la fuente de la que salió. Como la aplicación todavía no tiene eventos recurrentes propios, cada repetición de un evento repetido se convierte en un evento suelto.

## Usuarios / actores

- **Propietario:** persona con sesión que importa el .ics. Se convierte en propietaria del calendario creado.
- **Miembros del calendario importado:** Editores y Lectores que el propietario añada después con la spec 003. No intervienen en la importación.

## Historias de usuario

- H1: Como usuario quiero pegar el enlace .ics de mi calendario de Google, iCloud u Outlook para traer mis eventos a CalenderFam sin copiarlos a mano.
- H2: Como usuario quiero subir un archivo .ics que ya tengo descargado para importar un calendario que no tiene enlace.
- H3: Como propietario quiero que el calendario importado sea un calendario normal para editarlo, añadirle eventos y compartirlo con mi familia.
- H4: Como usuario quiero ver las repeticiones (cumpleaños, clases semanales) como eventos en sus días, aunque el origen las guardara como una serie.
- H5: Como usuario quiero saber qué se ha importado y qué no (eventos omitidos, series cortadas) para fiarme del resultado.
- H6: Como usuario quiero que, si algo falla, no me quede un calendario a medias.

## Requisitos funcionales (criterios de aceptación en EARS)

### Origen del .ics

- RF-1: CUANDO una persona con sesión indica un enlace .ics y confirma la importación, EL SISTEMA leerá el contenido de ese enlace una sola vez.
- RF-2: CUANDO una persona con sesión sube un archivo .ics y confirma la importación, EL SISTEMA leerá el contenido de ese archivo.
- RF-3: EL SISTEMA aceptará enlaces que empiecen por `https://` o por `webcal://`, y tratará `webcal://` como `https://`.
- RF-4: SI el enlace usa otro protocolo o apunta a una dirección que no es pública, ENTONCES EL SISTEMA no descargará nada, no creará ningún calendario y mostrará un mensaje de enlace no válido.
- RF-5: SI el enlace no se puede descargar (sin respuesta, respuesta de error o más de 15 segundos de espera), ENTONCES EL SISTEMA no creará ningún calendario y mostrará un mensaje que indica que no se ha podido leer el enlace.
- RF-6: EL SISTEMA no guardará el enlace ni el archivo una vez terminada la importación, ni los mostrará en ningún mensaje de error.

### Calendario creado

- RF-7: CUANDO la lectura es válida, EL SISTEMA creará un calendario nuevo cuyo propietario es la persona que importa y que contiene los eventos leídos.
- RF-8: DONDE la persona escriba un nombre en el formulario, EL SISTEMA usará ese nombre (de 1 a 50 caracteres) para el calendario nuevo.
- RF-9: SI la persona no escribe nombre, ENTONCES EL SISTEMA usará el nombre que traiga el .ics, recortado a 50 caracteres, o "Calendario importado" si no trae ninguno.
- RF-10: EL SISTEMA permitirá elegir en el formulario uno de los colores de la paleta de la spec 002 para el calendario nuevo, y usará el azul de marca si no se elige.
- RF-11: EL SISTEMA tratará el calendario importado como cualquier otro calendario propio, sin guardar ninguna relación con la fuente de la que salió.
- RF-12: SI se importa dos veces el mismo .ics, ENTONCES EL SISTEMA creará dos calendarios independientes sin detectar duplicados.

### Conversión de eventos

- RF-13: EL SISTEMA convertirá de cada evento su título, descripción, lugar, inicio, fin y si es de día completo, y descartará el resto de datos (invitados, alarmas, adjuntos, categorías y colores).
- RF-14: SI un evento no tiene título, ENTONCES EL SISTEMA le pondrá "(Sin título)".
- RF-15: SI el título, la descripción o el lugar de un evento superan los límites de la spec 002 (100, 2000 y 200 caracteres), ENTONCES EL SISTEMA los recortará a ese límite.
- RF-16: EL SISTEMA respetará la zona horaria que indique cada evento con hora, de modo que se vea a su hora real en la zona del perfil de quien lo mire.
- RF-17: EL SISTEMA guardará los eventos de día completo con la convención de la spec 002, de modo que no cambien de día entre zonas horarias.
- RF-18: SI un evento con hora no indica fin, ENTONCES EL SISTEMA le dará duración cero.
- RF-19: SI un evento de día completo no indica fin, ENTONCES EL SISTEMA le dará duración de un día.
- RF-20: SI un evento está marcado como cancelado, ENTONCES EL SISTEMA no lo importará.

### Eventos repetidos

- RF-21: SI un evento con hora indica una zona horaria que el sistema no reconoce, ENTONCES EL SISTEMA no lo importará y lo contará como omitido.
- RF-22: CUANDO un evento se repite, EL SISTEMA creará un evento suelto por cada repetición.
- RF-23: SI una serie no tiene fin o termina más tarde de un año después del día de la importación, ENTONCES EL SISTEMA creará sus repeticiones solo hasta ese día.
- RF-24: EL SISTEMA no creará las repeticiones que el origen excluya de una serie.
- RF-25: SI el origen modifica una repetición concreta de una serie (otro día, otra hora u otro título), ENTONCES EL SISTEMA creará esa repetición con los datos modificados y no la original.

### Límites y errores

- RF-26: SI el .ics ocupa más de 2 MB, ENTONCES EL SISTEMA no creará ningún calendario y mostrará el límite.
- RF-27: SI el .ics produciría más de 2.000 eventos tras convertir las repeticiones, ENTONCES EL SISTEMA no creará ningún calendario y mostrará cuántos eventos habría producido y el límite.
- RF-28: SI el contenido no es un .ics válido o no contiene ningún evento importable, ENTONCES EL SISTEMA no creará ningún calendario y mostrará un mensaje que lo explica.
- RF-29: SI algunos eventos no se pueden convertir y otros sí, ENTONCES EL SISTEMA creará el calendario con los eventos válidos y mostrará cuántos se han omitido.
- RF-30: SI ocurre un fallo mientras se crea el calendario, ENTONCES EL SISTEMA no dejará ni el calendario ni ninguno de sus eventos.

### Resultado y acceso

- RF-31: CUANDO la importación termina bien, EL SISTEMA mostrará cuántos eventos se han creado, cuántos se han omitido y cuántas series se han cortado por el límite de un año, y ofrecerá abrir el calendario nuevo.
- RF-32: MIENTRAS una importación está en curso, EL SISTEMA mostrará que está trabajando y no permitirá enviarla otra vez.
- RF-33: EL SISTEMA ofrecerá "Importar calendario" desde el panel.
- RF-34: SI quien intenta importar no tiene sesión, ENTONCES EL SISTEMA lo llevará a iniciar sesión.

## Requisitos no funcionales

- Privacidad: el enlace puede ser secreto (quien lo tiene ve todo el calendario de origen). No se guarda, no se registra y no aparece en mensajes de error (RF-6).
- Seguridad: la descarga desde el servidor solo llega a direcciones públicas por `https` (RF-3, RF-4); el archivo y el resultado tienen límite de tamaño (RF-26, RF-27).
- Rendimiento: una importación en el límite (2 MB y 2.000 eventos) termina en menos de 30 segundos.
- Coste cero: sin servicios de pago ni telemetría; la capa gratuita de Supabase y de Vercel tiene que bastar.
- Mobile-first y accesibilidad: formulario y resultado usables entre 360 y 1920 px, con teclado, con etiquetas visibles y con errores anunciados, como en las specs 002 y 003.
- Idioma: toda la interfaz y los mensajes en español.

## Casos límite

- Un .ics con un solo calendario pero con eventos de varios organizadores: se importan todos igual.
- Un .ics con miles de eventos pasados: cuentan para el límite de 2.000 (RF-27).
- Una serie semanal sin fin que empezó hace años: se crean sus repeticiones pasadas y las de los próximos 12 meses.
- Una repetición excluida en el origen que además tenía una versión modificada: se crea la modificada solo si el origen la mantiene (RF-24, RF-25).
- El enlace redirige a otra dirección: la dirección final también tiene que ser pública y `https` (RF-4).
- El enlace devuelve una página web en vez de un .ics: contenido no válido (RF-28).
- El navegador del usuario se cierra o pierde la conexión durante la importación: no queda un calendario a medias (RF-30).
- Un evento de día completo que dura varios días: se importa como un solo evento de varios días, igual que en la spec 002.
- Un evento cuyo fin es anterior a su inicio: se omite y cuenta como omitido (RF-29).
- Se importa justo después de otra importación grande: no hay límite por persona en esta spec, salvo el de cada importación.

## Fuera de alcance

- Mantener el calendario actualizado desde el enlace: ni sincronización automática ni botón "Actualizar" (la fuente se lee una sola vez).
- Guardar el enlace o el archivo.
- Importar a un calendario que ya existe: siempre se crea uno nuevo.
- Detectar o evitar duplicados entre importaciones.
- Exportar un calendario a .ics.
- Eventos recurrentes propios de la aplicación (las repeticiones importadas son eventos sueltos y no se pueden editar como serie).
- Alarmas, invitados, adjuntos, categorías o colores del origen.
- Otros formatos (CSV, vCard) y otros orígenes (cuentas de Google o Microsoft con OAuth, spec 006).
- Vista previa o confirmación del contenido antes de crear.
- Notificaciones o avisos cuando el origen cambie.
- Uso sin conexión con datos, tema oscuro e internacionalización.

## Criterios de finalización

- Todos los RF tienen test en verde (unitario, de componente o de base de datos según corresponda) y el checklist de verificación obligatoria pasa completo.
- Demo manual en móvil (≤ 768 px) y escritorio, con un .ics real de Google, otro de iCloud y otro de Outlook: importar por enlace y por archivo, ver los eventos y las repeticiones en las vistas, editar un evento importado y compartir el calendario con otra cuenta.
- Demo de los errores: enlace no válido, archivo que no es .ics y archivo por encima de los límites.
- Las migraciones, si las hay, están aplicadas en dev y en prod.
- El usuario aprueba el cierre de la spec.

## Dudas abiertas

- Resueltas con la aprobación: se actualizan la constitución y `AGENTS.md` (la 004 pasa a ser importación única y `ics_subscriptions` deja de hacer falta); un evento con zona horaria no reconocida se omite (RF-21); el límite baja a 2 MB y 2.000 eventos (RF-26, RF-27) y el plan comprobará que la importación en el límite termina en menos de 30 segundos.
- Pendiente para el plan, no para esta spec: elegir la librería de lectura de .ics y de expansión de repeticiones, que exige aprobación explícita del usuario (principio P6 de la constitución).
