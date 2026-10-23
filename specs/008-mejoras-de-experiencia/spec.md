# Spec 008 — Mejoras de experiencia de uso

> Estado: **Aprobada** por el usuario (2026-10-22). Pendiente de plan, tareas e implementación. Constitución: `docs/constitution.md` (P9 para lo visual). Parte de las specs 001 a 005 (cerradas).
> Numeración: se usa el 008 porque los números 006 (gestión de cuenta) y 007 (OAuth) están reservados en `AGENTS.md` para specs ya planificadas.
> Actualización (2026-10-22): dudas resueltas por el usuario (ver al final) y añadido el bloque "Uso diario" (RF-31 a RF-36), elegido por el usuario entre varias propuestas.
> Decisiones de la entrevista (2026-10-22):
> - Alcance: propuestas 1 a 4 y las mejoras propias de la sección "Mejoras propias". El arrastrar y soltar (propuesta 5) queda para una spec propia.
> - Clic en celdas: el hueco vacío crea el evento; el número del día sigue llevando a la vista diaria.
> - Selector de hora: intervalos de 30 minutos.
> - Ventana: el alta, la edición y el detalle de un evento se abren en una ventana sobre el calendario, con opción de pantalla completa. La propuesta 3 (popover) se sustituye por esa ventana.

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

## Requisitos funcionales (criterios de aceptación en EARS)

### Ventana de evento

- RF-1: CUANDO el usuario pulsa cualquier acceso para crear un evento (botón "+ Evento", "Crear" de la agenda o un hueco vacío de mes o semana), EL SISTEMA abrirá el alta en una ventana superpuesta al calendario, sin cambiar de página.
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

- RF-19: CUANDO el usuario pulsa un hueco vacío de una celda de la vista mes, EL SISTEMA abrirá el alta con esa fecha.
- RF-20: CUANDO el usuario pulsa una franja vacía de la vista semana, EL SISTEMA abrirá el alta con esa fecha.
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

## Mejoras propias

Incluidas por decisión del usuario, encontradas al revisar el código:

- Hora de fin automática (RF-17 y RF-18).
- Vista recordada (RF-25 a RF-27).
- Foco en el título al abrir el alta (RF-28).
- Uso diario, pedido tras la entrevista: atajos de teclado (RF-31), avisos y estados de carga (RF-32 y RF-33), datos al volver a la app (RF-34) y duplicar evento (RF-35 y RF-36).
- Salto a la hora actual en la agenda (RF-23 y RF-24).

## Fuera de alcance

- Arrastrar y soltar eventos entre días u horas (propuesta 5, con su propia spec).
- Eventos recurrentes propios, edición de una ocurrencia o de toda una serie.
- Popover de vista previa en la agenda (sustituido por la ventana).
- Búsqueda, papelera, deshacer y nuevas vistas.
- Zona horaria por evento y tema oscuro.
- Cambios en la gestión de cuenta (spec 006) o en la sincronización (007).

## Criterios de finalización

- Todos los RF con prueba en verde y el flujo principal (crear, editar, ver y borrar desde la ventana) probado en el navegador a 390 px y 1440 px.
- Revisión visual con capturas a 390, 768 y 1440 px con los acentos rojo y amarillo.
- Demo manual en producción y aprobación explícita del usuario para cerrar la spec.

## Dudas resueltas (entrevista, 2026-10-22)

- Vista recordada (RF-25): se guarda en la cuenta, igual en todos los dispositivos.
- Ventana en móvil (RF-29): siempre en pantalla completa a 768 px o menos.
- Hora de fin al cruzar el día (RF-30): se fija en 23:59 del mismo día.
- Franja de semana (RF-20): precarga solo la fecha.
- Cerrar con cambios sin guardar (RF-7): pide confirmación.
- Botón "Hora actual" (RF-23): siempre visible en la agenda.
- Enlaces directos (RF-10): abren la página completa.
- Pantalla completa en escritorio (RF-5): no se recuerda entre aperturas (sin respuesta explícita; se mantiene el valor por defecto propuesto).
