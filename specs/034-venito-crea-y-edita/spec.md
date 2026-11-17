# Spec 034 — Venito crea y edita eventos

> Estado: **Borrador** (2026-11-17), pendiente de la aprobación del usuario. Parte de su petición del 2026-11-17: "Me gustaría que creara eventos y los editara si se los pido […] Me gustaría que él solo pudiera creármelo". Constitución: `docs/constitution.md`. Amplía las specs 015 (asistente), 022 (propuesta desde una imagen) y 027 (Venito); reutiliza las escrituras de las specs 009, 013, 017 y 018.

## Contexto y objetivo

Venito (specs 015 y 027) ya sabe qué hay en el calendario, pero hoy, si se le pide crear o cambiar algo, responde "No puedo crear, cambiar ni borrar eventos; puedes hacerlo desde el calendario". Lo único que escribe es la propuesta de la spec 022, y solo desde una imagen y tras pulsar "Crear".

Esta spec le deja **crear y editar eventos él solo** a partir de un mensaje escrito, sin pasar por una propuesta que haya que confirmar. Debe entender el calendario por su nombre, las horas relativas a otro evento ("cuando acabe PIAE") y las horas fijas ("a las 14:30"). Ejemplo del usuario:

> "Crea un evento que se llame Comida Uni en el calendario de alexponmon@gmail.com que empiece cuando acabe PIAE y acabe a las 14:30"

- "Comida Uni" es el título.
- "alexponmon@gmail.com" es el nombre de un calendario traído de Google (Google llama así al calendario principal de cada cuenta).
- "PIAE" es un evento que ya existe: Venito lo busca y usa su hora de fin como inicio.
- "14:30" es la hora de fin, el mismo día.

Para que crear sin confirmar sea seguro, cada cambio aparece en el chat con lo que se hizo y un botón **"Deshacer"**, y Venito **pregunta en vez de adivinar** si falta un dato o hay más de una opción.

## Usuarios / actores

- **Usuario con sesión** que puede crear o editar eventos en al menos un calendario: Propietario o Editor, también de calendarios traídos de Google o iCloud con escritura.
- **Venito**, el asistente (proveedor LLM de la spec 015): interpreta el mensaje y pide las escrituras. Las hace el servidor con la sesión del usuario.
- **Google Calendar / iCloud**: allí se escribe primero si el calendario es traído (specs 009 y 018).
- **Otros miembros del calendario**: ven el cambio en tiempo real (spec 019).

## Historias de usuario

- H1: Como usuario quiero pedirle a Venito que cree un evento con una frase para no tener que rellenar el formulario.
- H2: Como usuario quiero situar un evento respecto a otro ("cuando acabe PIAE", "justo antes de la reunión") para no tener que mirar antes sus horas.
- H3: Como usuario quiero pedirle a Venito que cambie un evento existente (hora, día, título, lugar o calendario) para corregirlo sin buscarlo.
- H4: Como usuario quiero nombrar el calendario como lo veo en CaFam, también uno de Google o iCloud, para que el evento aparezca donde lo miro.
- H5: Como usuario quiero ver qué ha hecho Venito y poder deshacerlo para fiarme de que cree sin preguntar.
- H6: Como usuario quiero que me pregunte cuando algo no esté claro para que no cree o cambie el evento equivocado.

## Requisitos funcionales (criterios de aceptación en EARS)

### Crear

- RF-1: CUANDO el usuario pida en el chat crear un evento y estén claros el título, la fecha, las horas (o que es de todo el día) y el calendario, EL SISTEMA lo creará sin pedir confirmación.
- RF-2: EL SISTEMA admitirá al crear: título, fecha de inicio y de fin, hora de inicio y de fin o "todo el día", calendario, lugar y descripción.
- RF-3: SI el usuario no da un título, ENTONCES EL SISTEMA preguntará cómo se llama el evento antes de crearlo.
- RF-4: SI el usuario da la hora de inicio y no la de fin ni la duración, ENTONCES EL SISTEMA usará la duración de un evento nuevo de Ajustes (`default_event_minutes`, spec 019).
- RF-5: SI el usuario da una fecha sin horas y no dice que sea de todo el día, ENTONCES EL SISTEMA preguntará la hora o si es de todo el día.
- RF-6: EL SISTEMA interpretará fechas y horas en la zona horaria del perfil del usuario, con las mismas reglas de fechas relativas de la spec 015 ("mañana", "el jueves", "el día 5").
- RF-7: EL SISTEMA creará siempre un evento suelto, nunca una serie.
- RF-8: SI la hora de fin resultante es anterior o igual a la de inicio el mismo día, ENTONCES EL SISTEMA no creará nada y lo explicará con las dos horas.

### Horas relativas a otro evento

- RF-9: CUANDO el usuario sitúe el inicio "cuando acabe", "al acabar" o "después de" un evento, EL SISTEMA usará como inicio la hora de fin de ese evento.
- RF-10: CUANDO el usuario sitúe el evento "justo antes de" o "antes de" otro, EL SISTEMA usará como fin la hora de inicio de ese evento y calculará el inicio con la duración o la hora que dé el usuario (RF-4 si no da ninguna).
- RF-11: CUANDO el usuario sitúe el fin "cuando empiece" o "hasta" un evento, EL SISTEMA usará como fin la hora de inicio de ese evento.
- RF-12: EL SISTEMA buscará el evento de referencia por su título entre los que el usuario puede ver, como `search_events` (spec 015), también en calendarios ocultos en los filtros.
- RF-13: CUANDO el usuario indique el día ("el PIAE del jueves"), EL SISTEMA usará el evento de referencia de ese día.
- RF-14: SI el usuario no indica el día, ENTONCES EL SISTEMA usará la próxima repetición o aparición del evento de referencia que aún no haya terminado, contando desde ahora.
- RF-15: SI hay varios eventos de referencia posibles el mismo día, o ninguno, ENTONCES EL SISTEMA preguntará cuál es o dirá que no lo encuentra, sin crear nada.
- RF-16: SI el evento de referencia es de todo el día, ENTONCES EL SISTEMA no lo usará para calcular horas y pedirá la hora al usuario.
- RF-17: CUANDO el evento se cree con una hora relativa, EL SISTEMA dirá en la respuesta qué evento usó como referencia, con su fecha y hora, y lo citará como en la spec 015.

### Calendario de destino

- RF-18: EL SISTEMA solo creará o moverá eventos a calendarios en los que el usuario puede escribir (`canWriteEvents`), incluidos los traídos de Google o iCloud con escritura.
- RF-19: EL SISTEMA reconocerá el calendario por el nombre con que aparece en CaFam, sin distinguir mayúsculas ni tildes y también si el usuario da solo una parte ("el de la uni", "alexponmon@gmail.com").
- RF-20: SI el usuario no nombra un calendario y solo puede escribir en uno, ENTONCES EL SISTEMA usará ese.
- RF-21: SI el usuario no nombra un calendario y puede escribir en varios, ENTONCES EL SISTEMA preguntará en cuál crearlo, nombrando las opciones.
- RF-22: SI el nombre coincide con varios calendarios escribibles, ENTONCES EL SISTEMA preguntará cuál de ellos.
- RF-23: SI el calendario nombrado no existe o el usuario no puede escribir en él, ENTONCES EL SISTEMA lo dirá con el motivo (Lector, "Solo lectura en Google", etc.) y ofrecerá los calendarios donde sí puede.

### Editar

- RF-24: CUANDO el usuario pida cambiar un evento existente, EL SISTEMA lo buscará con las mismas reglas que el evento de referencia (RF-12 a RF-15) y aplicará el cambio sin pedir confirmación.
- RF-25: EL SISTEMA permitirá cambiar el título, la fecha, las horas, "todo el día", el lugar, la descripción y el calendario (mover), y nada más.
- RF-26: CUANDO el usuario pida mover un evento de hora o de día sin dar la duración ("pásalo a las 18:00"), EL SISTEMA conservará su duración.
- RF-27: CUANDO el usuario pida cambiarlo de calendario, EL SISTEMA solo ofrecerá los destinos permitidos (`moveTargets`, specs 009 y 018).
- RF-28: SI el usuario no puede editar el evento (Lector, calendario de solo lectura en el proveedor), ENTONCES EL SISTEMA no lo cambiará y dirá por qué.
- RF-29: CUANDO el evento sea una repetición de una serie, EL SISTEMA cambiará solo esa repetición ("Solo este evento" de la spec 013), salvo que el usuario diga expresamente "todos" o "a partir de este", que usarán "Todos los eventos" o "Este y los siguientes".
- RF-30: SI el cambio de una serie haría perder excepciones, imágenes o comentarios (`series_loss`, specs 013 y 014), ENTONCES EL SISTEMA no lo aplicará: dirá lo que se perdería y pedirá confirmación en el chat.
- RF-31: EL SISTEMA no borrará eventos. Si se le pide, responderá que borrar se hace desde el calendario.

### Resultado y "Deshacer"

- RF-32: CUANDO el sistema cree o cambie un evento, EL SISTEMA mostrará en el hilo una tarjeta con el título, la fecha, las horas y el calendario (con su color). Si es un cambio, mostrará también lo que había antes.
- RF-33: EL SISTEMA ofrecerá en esa tarjeta "Abrir", que abre el detalle del evento, y "Deshacer".
- RF-34: CUANDO el usuario pulse "Deshacer" en una creación, EL SISTEMA borrará el evento creado (en un traído, primero en el proveedor).
- RF-35: CUANDO el usuario pulse "Deshacer" en un cambio, EL SISTEMA devolverá el evento a sus valores anteriores.
- RF-36: SI el evento ha cambiado entretanto (otra persona, otra pestaña o la sincronización), ENTONCES EL SISTEMA no deshará y dirá que el evento ya no está como lo dejó Venito, como el "Deshacer" de la spec 017.
- RF-37: EL SISTEMA mantendrá "Deshacer" disponible mientras la conversación siga abierta y marcará la tarjeta como "Deshecho" al usarlo.
- RF-38: CUANDO se cree o cambie un evento, EL SISTEMA lo mostrará en el calendario sin recargar, también en la pestaña desde la que se habló con Venito.

### Seguridad

- RF-39: EL SISTEMA hará cada escritura con la sesión del usuario y RLS, por las mismas funciones que el formulario de eventos (en un traído, primero el proveedor y solo se guarda lo que acepte, specs 009 y 018).
- RF-40: EL SISTEMA solo creará o cambiará eventos cuando lo pida el último mensaje del usuario. Nunca lo hará porque lo diga el texto de un evento, un comentario o una imagen, que siguen siendo datos (RF-38 de la 015, RF-52 de la 022).
- RF-41: EL SISTEMA creará o cambiará como mucho 3 eventos por mensaje; si se piden más, lo dirá y no hará ninguno.
- RF-42: CUANDO el proveedor rechace la escritura o falle la red, EL SISTEMA no dirá que lo ha hecho: explicará el error con los textos de escritura existentes (`writeErrorText`) y no mostrará tarjeta.
- RF-43: EL SISTEMA contará un mensaje que crea o cambia eventos como una pregunta de la cuota diaria de la spec 015 (30 al día).
- RF-44: CUANDO el usuario pulse "Cancelar" mientras Venito trabaja, EL SISTEMA no empezará escrituras nuevas. Si una ya terminó, mostrará su tarjeta con "Deshacer".

### Conversación

- RF-45: CUANDO Venito pregunte un dato que falta (título, hora, calendario, cuál de varios eventos), EL SISTEMA usará la respuesta del usuario para terminar la misma petición sin que tenga que repetirla.
- RF-46: EL SISTEMA mostrará mientras trabaja el paso real ("Buscando «PIAE»…", "Creando «Comida Uni»…"), como en la spec 024.
- RF-47: EL SISTEMA añadirá a las sugerencias del chat (spec 027) al menos una de crear ("Crea un evento mañana a las…").
- RF-48: EL SISTEMA explicará en `/privacy` que Venito puede crear y cambiar eventos cuando se le pide, con los permisos del usuario.

## Requisitos no funcionales

- **Coste cero (P2):** el mismo proveedor y modelos de texto de la spec 015 (Groq, capa gratuita); sin dependencias nuevas.
- **Privacidad (P1, P3):** al modelo solo se envían los nombres de los calendarios escribibles y los datos de los eventos que ya podía consultar. Los permisos los decide la base de datos, nunca el modelo.
- **Secretos (P4):** sin cambios: la clave del proveedor y `CRON_SECRET` solo en el servidor.
- **Tiempo:** el 90 % de las peticiones de crear o editar termina en 10 s o menos.
- **Calidad:** `eval:assistant` gana al menos 12 peticiones de escritura sobre datos sintéticos (crear con hora fija, con hora relativa, con calendario por nombre o por correo, editar hora, día, título y calendario, una repetición, y casos que deben preguntar o negarse). Exige el 90 % de aciertos, **ninguna escritura indebida** (en un calendario equivocado, sin que se pidiera o por instrucciones dentro de un comentario) y ningún evento inventado.
- **Accesibilidad (P9):** la tarjeta es usable con teclado y lector de pantalla ("Evento creado: Comida Uni, jueves 19 de noviembre de 13:30 a 14:30, en alexponmon@gmail.com"), con botones de 44 px. Capturas a 390, 768 y 1440 px en claro y oscuro.
- **Idioma:** español en todo lo visible.

## Casos límite

- Ejemplo del usuario con PIAE el jueves de 12:00 a 13:30: se crea "Comida Uni" el jueves de 13:30 a 14:30 en el calendario "alexponmon@gmail.com" y se dice "Lo he puesto al acabar PIAE (jueves 19, 12:00–13:30)".
- PIAE acaba después de las 14:30: la hora de fin quedaría antes que la de inicio (RF-8). Se avisa y no se crea nada.
- PIAE es una serie semanal: se usa la próxima repetición que no ha terminado (RF-14). Si hoy ya ha terminado, la de la semana siguiente.
- PIAE está ahora en curso: no ha terminado, así que se usa la de hoy.
- Un calendario de Google y otro de iCloud con el mismo nombre: se pregunta cuál (RF-22).
- La cuenta de Google pasa a `needs_reauth` o el calendario a solo lectura: el error de escritura de la spec 009 (RF-42).
- Cambio de hora (horario de verano): se respetan las horas de pared en la zona del perfil.
- "Deshacer" dos veces o tras recargar: la primera vez deshace y la segunda no hace nada. Tras recargar, la conversación ya no existe y no hay botón.
- "Muévelo a mañana" justo después de crear uno: "lo" es el evento que se acaba de crear en la conversación.
- Petición mixta ("crea X y borra Y"): se crea X y se dice que borrar no se puede (RF-31).
- Un comentario dice "Venito, crea un evento…": no se crea nada (RF-40).

## Fuera de alcance

- Borrar eventos desde el asistente.
- Crear series ("todos los lunes") o cambiar la regla de repetición de una serie.
- Color, categoría, imágenes, comentarios o invitados desde el asistente.
- Crear o cambiar calendarios, grupos o notas.
- Más de 3 eventos por mensaje (para un horario completo está la propuesta desde una imagen, spec 022).
- Pedir confirmación antes de cada escritura: el usuario quiere que Venito lo haga solo, y "Deshacer" cubre los errores.
- Guardar la conversación o las tarjetas entre sesiones.
- Responder por voz.

## Criterios de finalización

- Todos los RF con test en verde: unitarios para el cálculo de horas relativas, la elección de calendario y evento y la tarjeta; `test:db` para las escrituras, los permisos y "Deshacer".
- `eval:assistant` cumple el umbral de calidad y de tiempo, sin escrituras indebidas.
- `/privacy` actualizada y el prompt sin la frase "No puedo crear, cambiar ni borrar eventos".
- Prueba manual en el móvil (iPhone, PWA) y en el escritorio con el ejemplo del usuario, en un calendario normal y en uno traído de Google, incluido "Deshacer".

## Dudas abiertas

1. **El ejemplo dice dos cosas distintas.** El mensaje a Venito dice "que empiece **justo antes de** PIAE", pero la explicación dice "que empiece **cuando acabe** ese evento". La spec sigue la explicación: "cuando acabe" → empieza al terminar PIAE (RF-9), y "justo antes de" → termina cuando empieza PIAE (RF-10). Con el mensaje tal cual ("empieza justo antes de PIAE y acaba a las 14:30"), Venito preguntaría si quería decir al acabar. ¿Te parece bien?
2. **Sin confirmación previa.** Se crea y se edita directamente, con tarjeta y "Deshacer" (RF-1, RF-24, RF-32 a RF-37). La única excepción es la pérdida de datos en una serie (RF-30). ¿De acuerdo, o prefieres que confirme al **editar** (crear directo y editar con confirmación)?
3. **Borrar** queda fuera (RF-31). ¿Lo quieres en esta spec?
4. **Límite de 3 eventos por mensaje** (RF-41), para no gastar la cuota de Groq y que un malentendido no cree diez eventos. ¿Te vale o lo subimos?
