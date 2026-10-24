# Spec 008 — Mejoras de experiencia de uso

> Estado: **Cerrada** (2026-10-24) por decisión del usuario. T1–T23 hechas. Aplicada en producción y validada por el usuario. Constitución: `docs/constitution.md` (P9 para lo visual). Parte de las specs 001 a 005 (cerradas).
> Numeración: se usa el 008 porque los números 006 (gestión de cuenta) y 007 (OAuth) están reservados en `AGENTS.md` para specs ya planificadas.
> Actualización (2026-10-22): dudas resueltas por el usuario (ver al final) y añadido el bloque "Uso diario" (RF-31 a RF-36), elegido por el usuario entre varias propuestas.
> Decisiones de la entrevista (2026-10-22):
> - Alcance: propuestas 1 a 4 y las mejoras propias de la sección "Mejoras propias". El arrastrar y soltar (propuesta 5) queda para una spec propia.
> - Clic en celdas: el hueco vacío crea el evento; el número del día sigue llevando a la vista diaria.
> - Selector de hora: intervalos de 30 minutos.
> - Ventana: el alta, la edición y el detalle de un evento se abren en una ventana sobre el calendario, con opción de pantalla completa. La propuesta 3 (popover) se sustituye por esa ventana.
> Ampliación (2026-10-23), tras analizar Google Calendar con REA (`analisis-google-calendar.md`) y con decisiones del usuario:
> - Alta en dos pasos: ventana rápida junto al hueco y "Más opciones" para el formulario completo (RF-37 a RF-41).
> - Arrastrar para **crear** en semana y día (RF-42 a RF-45). Mover eventos ya creados sigue fuera de alcance.
> - Clic en un día vacío del mes → evento de día completo; clic en una franja de semana o día → esa media hora, 1 h (cambian RF-19 y RF-20).
> - Atajos de vista, rejilla a toda altura, mes con punto o barra y duración en la lista de la hora de fin (RF-46 a RF-49).
> - La ventana se monta con rutas interceptadas de Next (decisión técnica del usuario, detalle en el plan).
> - Ampliación aprobada por el usuario (2026-10-23).

## Contexto y objetivo

Crear, editar o consultar un evento obliga hoy a cambiar de página completa y a escribir horas a mano sin ayuda. Al crear un evento desde una agenda o una vista de mes se pierde el sitio en el que se estaba. Esta spec reduce esa fricción: el formulario y el detalle aparecen sobre el calendario, las horas se eligen de una lista, un clic en un hueco vacío propone la fecha, la agenda permite saltar a la hora actual y la app recuerda la vista elegida. Todo lo que hoy funciona (permisos, validaciones, mensajes, flujos) sigue igual.

## Usuarios / actores

- **Usuario con sesión:** cualquier persona registrada, sea Propietario, Editor o Lector. Crea, edita o consulta eventos según su rol, como hoy.
- **Usuario de teclado o lector de pantalla:** debe poder hacer todo lo anterior sin ratón.

## Historias de usuario

- H1: Como usuario quiero crear, editar y ver un evento sin salir del calendario para seguir viendo el contexto.
- H2: Como usuario quiero pasar a pantalla completa cuando necesito espacio, y volver a la ventana cuando no.
- H3: Como usuario quiero elegir la hora en una lista de 30 en 30 minutos en lugar de escribirla.
- H4: Como usuario quiero pulsar un hueco vacío del calendario y crear un evento en ese día.
- H5: Como usuario quiero que al abrir la app vuelva la vista que usé la última vez.
- H6: Como usuario de la agenda quiero volver a la hora actual con un toque cuando me he alejado.
- H7: Como usuario quiero crear un evento sencillo (título, hora y calendario) en unos segundos, y abrir el formulario completo solo si lo necesito.
- H8: Como usuario de escritorio quiero arrastrar sobre las horas para crear un evento con esa duración.
- H9: Como usuario de Google o Outlook quiero que el calendario funcione como estoy acostumbrado (atajos, rejilla, vista mes).

## Requisitos funcionales (criterios de aceptación en EARS)

### Ventana de evento

- RF-1: CUANDO el usuario pulsa el botón "+ Evento" o "Crear" de la agenda, EL SISTEMA abrirá el formulario completo de alta en una ventana superpuesta al calendario, sin cambiar de página. Los huecos vacíos de mes, semana y día abren la ventana rápida (RF-37).
- RF-2: CUANDO el usuario pulsa un evento en cualquier vista (agenda, mes, semana o día), EL SISTEMA abrirá su detalle en la ventana.
- RF-3: CUANDO el usuario pulsa "Editar" en el detalle, EL SISTEMA mostrará el formulario de edición en la misma ventana.
- RF-4: MIENTRAS la ventana está abierta, EL SISTEMA mostrará el calendario atenuado detrás y mantendrá el foco dentro de la ventana.
- RF-5: CUANDO el usuario pulsa el botón de pantalla completa, EL SISTEMA ocupará toda la pantalla con la ventana y ofrecerá un botón para volver a la ventana, conservando lo escrito.
- RF-29: MIENTRAS el ancho sea de 768 px o menos, EL SISTEMA abrirá siempre la ventana de evento en pantalla completa, sin botón para volver a la ventana.
- RF-6: CUANDO el usuario cierra la ventana con el botón "Cerrar" o con la tecla Escape, EL SISTEMA la cerrará y devolverá el foco al elemento que la abrió.
- RF-7: SI el usuario cierra la ventana con cambios sin guardar, ENTONCES EL SISTEMA pedirá confirmación antes de descartarlos.
- RF-8: CUANDO el usuario guarda o borra un evento desde la ventana, EL SISTEMA la cerrará y mostrará el calendario actualizado, con la misma fecha y vista.
- RF-9: SI el guardado falla, ENTONCES EL SISTEMA mantendrá la ventana abierta con los datos escritos y mostrará el error.
- RF-10: SI el usuario abre directamente la dirección de alta o de detalle de un evento (recarga o enlace), ENTONCES EL SISTEMA mostrará la página completa como hasta ahora.
- RF-11: EL SISTEMA aplicará a la ventana las mismas reglas de permisos, validaciones y mensajes de las specs 002 y 005.
- RF-12: EL SISTEMA permitirá abrir, recorrer y cerrar la ventana solo con teclado, y anunciará su título a los lectores de pantalla.

### Selector de hora

- RF-13: CUANDO un campo de hora de inicio o de fin recibe el foco, EL SISTEMA ofrecerá una lista de horas de 00:00 a 23:30 en intervalos de 30 minutos.
- RF-14: CUANDO el usuario elige una hora de la lista, EL SISTEMA la escribirá en el campo y cerrará la lista.
- RF-15: SI el usuario pulsa Escape con la lista abierta, ENTONCES EL SISTEMA cerrará la lista sin cambiar el valor del campo.
- RF-16: EL SISTEMA permitirá escribir a mano cualquier hora válida, también las que no están en la lista.
- RF-17: CUANDO el usuario cambia la hora de inicio y no ha modificado la de fin, EL SISTEMA moverá la hora de fin para conservar la duración del evento (en un alta nueva, 1 hora).
- RF-18: CUANDO el usuario modifica la hora de fin a mano, EL SISTEMA dejará de mover la hora de fin al cambiar la de inicio.
- RF-30: SI la hora de fin calculada pasa de las 23:59 del día del evento, ENTONCES EL SISTEMA la fijará en 23:59 de ese mismo día.

### Creación desde el calendario

- RF-19: CUANDO el usuario pulsa un hueco vacío de una celda de la vista mes, EL SISTEMA abrirá la ventana rápida con un evento de día completo en esa fecha y un botón "Añadir hora" que lo convierte en evento con hora.
- RF-20: CUANDO el usuario pulsa una franja vacía de la vista semana o día, EL SISTEMA abrirá la ventana rápida con un evento que empieza en la media hora pulsada y dura 1 hora (con el límite de RF-30).
- RF-21: CUANDO el usuario pulsa el número de un día en las vistas mes o semana, EL SISTEMA abrirá la vista diaria de ese día, como hasta ahora.
- RF-22: EL SISTEMA permitirá activar la creación de un evento en un hueco vacío desde el teclado.
- RF-28: CUANDO se abre el alta de un evento, EL SISTEMA situará el cursor en el campo Título.

### Vista agenda

- RF-23: MIENTRAS la vista agenda esté abierta, EL SISTEMA mostrará un botón "Hora actual".
- RF-24: CUANDO el usuario pulsa "Hora actual", EL SISTEMA desplazará la pantalla hasta la línea de la hora actual del día de hoy.

### Vista recordada

- RF-25: CUANDO el usuario elige una vista (agenda, mes, semana o día), EL SISTEMA guardará esa vista en su cuenta, igual en todos sus dispositivos.
- RF-26: CUANDO el usuario abre el calendario sin indicar vista en la dirección, EL SISTEMA mostrará la última vista guardada con la fecha de hoy; si no hay ninguna, mostrará la agenda.
- RF-27: SI la dirección indica una vista, ENTONCES EL SISTEMA mostrará esa vista y no la guardada.

### Uso diario

- RF-31: MIENTRAS el foco no esté en un campo de texto, EL SISTEMA atenderá las teclas N (alta de evento), T (hoy), flechas izquierda y derecha (periodo anterior y siguiente) y Escape (cierra la ventana abierta).
- RF-32: CUANDO el usuario guarda, borra o duplica un evento, EL SISTEMA mostrará un aviso breve con el resultado que desaparece solo y se anuncia a los lectores de pantalla.
- RF-33: MIENTRAS una vista carga sus eventos, EL SISTEMA mostrará una estructura de carga con la forma de la vista, en lugar de una pantalla vacía.
- RF-34: CUANDO la app vuelve a primer plano con sesión, EL SISTEMA actualizará los eventos mostrados si han pasado más de 60 segundos desde la última carga.
- RF-35: CUANDO el usuario pulsa "Duplicar" en el detalle de un evento, EL SISTEMA abrirá el alta con los mismos datos del evento (título, descripción, lugar, color, categoría, hora y duración), que el usuario podrá cambiar antes de guardar. Nada se guarda hasta que el usuario confirma.
- RF-36: SI el usuario no puede crear eventos en el calendario (rol Lector), ENTONCES EL SISTEMA no ofrecerá "Duplicar" ni los atajos de creación (N).

### Alta rápida (ampliación REA)

- RF-37: CUANDO el usuario pulsa un hueco vacío de mes, semana o día, o termina de arrastrar (RF-42), EL SISTEMA abrirá junto al hueco una ventana rápida con el título (con el cursor), el día y las horas, el calendario con su color, y los botones "Más opciones" y "Guardar".
- RF-38: CUANDO el usuario pulsa "Guardar" en la ventana rápida, EL SISTEMA creará el evento con esos datos (sin descripción, lugar ni categoría, y con el color del calendario), cerrará la ventana y mostrará el aviso de RF-32.
- RF-39: CUANDO el usuario pulsa "Más opciones", EL SISTEMA mostrará el formulario completo en la ventana con lo escrito (título, fecha, horas, día completo y calendario).
- RF-40: MIENTRAS la ventana rápida está abierta, EL SISTEMA marcará el hueco elegido en la rejilla con un bloque provisional que muestra el título escrito o "(Sin título)".
- RF-41: MIENTRAS el ancho sea de 768 px o menos, EL SISTEMA mostrará la ventana rápida como una hoja anclada al borde inferior, a todo el ancho.

### Arrastrar para crear (ampliación REA)

- RF-42: CUANDO el usuario pulsa con el ratón en una franja vacía de la vista semana o día y arrastra en vertical, EL SISTEMA dibujará el bloque provisional del intervalo en pasos de 15 minutos y, al soltar, abrirá la ventana rápida con ese inicio y ese fin.
- RF-43: EL SISTEMA limitará el arrastre al día en que empezó; la duración mínima será de 15 minutos.
- RF-44: SI el usuario pulsa Escape durante el arrastre, ENTONCES EL SISTEMA lo cancelará sin abrir la ventana.
- RF-45: MIENTRAS el gesto sea táctil, EL SISTEMA no iniciará el arrastre (el gesto desplaza la rejilla); un toque en una franja actúa como el clic de RF-20.

### Vistas al estilo Google (ampliación REA)

- RF-46: MIENTRAS el foco no esté en un campo de texto ni haya una ventana abierta, EL SISTEMA atenderá las teclas A (agenda), M (mes), S (semana) y D (día), que cambian de vista conservando la fecha, y cada botón de vista mostrará su tecla.
- RF-47: EL SISTEMA hará que la rejilla horaria de semana y día ocupe el alto disponible de la pantalla bajo la barra de navegación, con desplazamiento propio.
- RF-48: MIENTRAS la vista mes esté abierta, EL SISTEMA mostrará los eventos con hora como punto del color + hora + título, y los de día completo o de varios días como una barra del color con el título.
- RF-49: CUANDO se abre la lista de la hora de fin, EL SISTEMA la empezará en la hora de inicio, en intervalos de 30 minutos, y mostrará junto a cada hora la duración resultante ("11:00 (1 h)").

## Requisitos no funcionales

- NF-1: Toda pantalla o control nuevo sigue la identidad visual de la constitución (P9), usa solo tokens de diseño y pasa la guardia `design-tokens`.
- NF-2: Se revisa con capturas a 390, 768 y 1440 px, con el acento rojo y con el amarillo.
- NF-3: Cumple el contraste de RF-14 de la spec 005 y es operable con teclado.
- NF-4: No se añaden dependencias nuevas (stack cerrado, P6).
- NF-5: Los datos de los eventos y las reglas de permisos no cambian.

## Casos límite

- Hora de fin calculada que cruza la medianoche o el último día del evento (ver Dudas).
- Hora escrita a mano que no es válida: se muestra el mismo error que hoy, sin cerrar la ventana.
- Un calendario que el usuario deja de poder ver mientras tiene la ventana abierta: al guardar se explica que ya no existe o que no tiene permiso.
- Hueco vacío en un día sin espacio para más eventos: la creación sigue disponible.
- Cambio de vista con la ventana abierta: no ocurre; mientras la ventana está abierta el calendario de fondo no navega.
- Arrastre que empieza sobre un evento: no crea nada; el clic abre ese evento (RF-2).
- Arrastre hacia arriba: el intervalo va del punto de llegada al de partida.
- Arrastre fuera de la rejilla: se queda en el borde del día (00:00 o 24:00, con el fin limitado por RF-30).
- Usuario solo Lector en todos sus calendarios: los huecos no abren la ventana rápida ni se puede arrastrar (RF-36).

## Mejoras propias

Incluidas por decisión del usuario, encontradas al revisar el código:

- Hora de fin automática (RF-17 y RF-18).
- Vista recordada (RF-25 a RF-27).
- Foco en el título al abrir el alta (RF-28).
- Uso diario, pedido tras la entrevista: atajos de teclado (RF-31), avisos y estados de carga (RF-32 y RF-33), datos al volver a la app (RF-34) y duplicar evento (RF-35 y RF-36).
- Salto a la hora actual en la agenda (RF-23 y RF-24).

## Fuera de alcance

- Arrastrar y soltar eventos **ya creados** entre días u horas, y cambiar su duración arrastrando el borde (propuesta 5, con su propia spec). Arrastrar para **crear** sí entra (RF-42 a RF-45).
- "Deshacer" en el aviso de guardado, vistas de año y de 4 días, y menú de tipos en "Crear" (vistos en Google, descartados).
- Eventos recurrentes propios, edición de una ocurrencia o de toda una serie.
- Popover de vista previa en la agenda (sustituido por la ventana).
- Búsqueda, papelera, deshacer y nuevas vistas.
- Zona horaria por evento y tema oscuro.
- Cambios en la gestión de cuenta (spec 006) o en la sincronización (007).

## Criterios de finalización

- Todos los RF con prueba en verde y el flujo principal (crear con la ventana rápida, arrastrando y con el formulario completo; editar, ver y borrar desde la ventana; cambiar de vista con botones y atajos) probado en el navegador a 390 px y 1440 px.
- Revisión visual con capturas a 390, 768 y 1440 px con los acentos rojo y amarillo.
- Demo manual en producción y aprobación explícita del usuario para cerrar la spec.

## Dudas resueltas (entrevista, 2026-10-22)

- Vista recordada (RF-25): se guarda en la cuenta, igual en todos los dispositivos.
- Ventana en móvil (RF-29): siempre en pantalla completa a 768 px o menos.
- Hora de fin al cruzar el día (RF-30): se fija en 23:59 del mismo día.
- Franja de semana (RF-20): precarga solo la fecha. **Sustituida el 2026-10-23**: precarga la media hora pulsada y 1 h de duración, como Google.
- Cerrar con cambios sin guardar (RF-7): pide confirmación.
- Botón "Hora actual" (RF-23): siempre visible en la agenda.
- Enlaces directos (RF-10): abren la página completa.
- Pantalla completa en escritorio (RF-5): no se recuerda entre aperturas (sin respuesta explícita; se mantiene el valor por defecto propuesto).
