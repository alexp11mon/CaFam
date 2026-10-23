# Tasks 008 - Mejoras de experiencia de uso

> Estado: **Aprobadas** por el usuario (2026-10-23). Implementación en curso.
> Spec: `specs/008-mejoras-de-experiencia/spec.md`. Plan: `specs/008-mejoras-de-experiencia/plan.md`. Análisis: `analisis-google-calendar.md`.
> Reglas: una tarea cada vez, test primero (rojo → verde). Al cerrar cada tarea se ejecuta y reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, y `npm run test:db -- <filtro>` si toca esquema o acceso a datos. Si toca interfaz, prueba en el navegador con `playwright-cli` y capturas a 390, 768 y 1440 px con los acentos rojo y amarillo (P9). Un commit por tarea citándola, en la rama `008-mejoras-de-experiencia`.
> Sin dependencias nuevas (P6). Una sola migración (T10).

## Iteración 1 — ventana de evento, horas y vistas

- [x] T1 Montar el slot `@modal` y la ventana `EventModal` vacía
  Pasos: test primero en `tests/unit/event-modal.test.tsx` (con `showModal` simulado): abre como diálogo con el título enlazado (`aria-labelledby`), "Cerrar" y Escape llaman a `router.back()` y devuelven el foco al elemento que tenía el foco al abrir, el botón de pantalla completa alterna la clase y no aparece a ≤ 768 px (`matchMedia` simulado). Crear `@modal/default.tsx` (`null`), recibir `modal` en `dashboard/layout.tsx` y una ruta interceptada provisional `(.)events/[id]` que pinta solo el título del evento.
  Hecho cuando: `npm test -- event-modal` en verde y, en el navegador, abrir un evento desde la semana muestra la ventana con el calendario detrás, Atrás la cierra y recargar la URL da la página completa (R1). Cubre: RF-4, RF-5, RF-6, RF-10, RF-12, RF-29 | Módulo: modal-routes, event-modal

- [x] T2 Extraer los cargadores del alta y del detalle y aceptar los parámetros nuevos
  Pasos: test primero en `tests/unit/new-event-query.test.ts` para la función pura `parseNewEventQuery(query, editables, hoy)`: `date`, `calendar`, `start`, `end` (`HH:MM`), `allDay=1` y `title` (≤ 100) válidos se usan; los no válidos se ignoran con los valores por defecto de hoy. `load-new-event.ts` y `load-event.ts` reúnen la carga de las páginas actuales; las páginas completas pasan a usarlos sin cambiar lo que muestran.
  Hecho cuando: `npm test -- new-event-query` en verde y los tests existentes de las páginas de evento siguen en verde. Cubre: RF-10, RF-11, RF-39 | Módulo: event-loaders

- [x] T3 Devolver estado en lugar de redirigir en modo ventana
  Pasos: test primero en `tests/unit/event-actions.test.ts` (Supabase simulado): con `mode=modal`, `createEvent` y `updateEvent` devuelven `{ done }` y llaman a `revalidatePath`; con un error de validación devuelven `fieldErrors` y los valores escritos; sin `mode` siguen redirigiendo; `deleteEvent(id, "modal")` devuelve `{ done: "deleted" }`.
  Hecho cuando: `npm test -- event-actions` en verde. Cubre: RF-8, RF-9, RF-11, RF-38 | Módulo: modal-actions

- [x] T4 Añadir los avisos breves
  Pasos: test primero en `tests/unit/toast.test.tsx`: `useToast().show("Evento creado")` pinta el texto en una región `role="status"` con `aria-live="polite"` y desaparece a los 4 s (temporizadores falsos). La región se monta en `AppFrame`.
  Hecho cuando: `npm test -- toast` en verde y la guardia `design-tokens` en verde. Cubre: RF-32 | Módulo: toast

- [x] T5 Abrir el alta en la ventana y cerrarla al guardar
  Pasos: test primero en `tests/unit/event-modal-form.test.tsx`: al guardar con `{ done: "created" }` se cierra, se refresca y se muestra "Evento creado"; con error sigue abierta con lo escrito; cerrar con cambios pide confirmación ("Descartar cambios" / "Seguir editando") y sin cambios cierra directamente. Ruta interceptada `(.)events/new` con `EventForm` y `mode=modal`.
  Hecho cuando: `npm test -- event-modal-form` en verde y, en el navegador, "+ Evento" (barra inferior y escritorio) y "Crear" de la agenda abren la ventana y el evento creado aparece en la misma vista y fecha. Cubre: RF-1, RF-7, RF-8, RF-9 | Módulo: modal-routes, event-modal

- [x] T6 Abrir el detalle en la ventana con Editar, Duplicar y Borrar
  Pasos: test primero en `tests/unit/event-panel.test.tsx`: el detalle muestra "Editar", "Duplicar" y "Borrar" a propietario y editor, y ninguno a un Lector; "Editar" cambia al formulario en el mismo sitio; "Duplicar" navega a `/dashboard/events/new?from=<id>`. `parseNewEventQuery` (T2) acepta `from` y el cargador rellena título, descripción, lugar, color, categoría, hora y duración leyendo el evento con RLS. La ruta interceptada definitiva `(.)events/[id]` sustituye a la provisional de T1 y la página completa usa `EventPanel`.
  Hecho cuando: `npm test -- event-panel new-event-query` en verde y, en el navegador, ver, editar, duplicar y borrar desde la ventana funcionan con el aviso correspondiente. Cubre: RF-2, RF-3, RF-35, RF-36 | Módulo: event-panel, duplicate

- [x] T7 Calcular las listas de horas y la hora de fin
  Pasos: test primero en `tests/unit/time-options.test.ts`: `startOptions()` da 48 horas de 00:00 a 23:30; `endOptions("10:00")` empieza en 10:30 con "30 min", sigue con "1 h", "1 h 30 min" y termina en 23:30; `normalizeTime` acepta `9:05`, `0905` y `09:05` y rechaza `24:00` o `9:60`; `shiftEnd` conserva la duración y `clampEnd` fija 23:59 al pasarse del día.
  Hecho cuando: `npm test -- time-options` en verde. Cubre: RF-13, RF-16, RF-17, RF-30, RF-49 | Módulo: time-options

- [x] T8 Crear el campo de hora con lista desplegable
  Pasos: test primero en `tests/unit/time-field.test.tsx`: al recibir el foco aparece la lista (`role="listbox"`, campo `role="combobox"` con `aria-expanded`); flechas y Intro eligen; un clic escribe la hora y cierra; Escape cierra sin cambiar; se puede escribir una hora fuera de la lista; la lista de fin muestra la duración.
  Hecho cuando: `npm test -- time-field` en verde. Cubre: RF-13, RF-14, RF-15, RF-16, RF-49 | Módulo: time-field

- [x] T9 Usar el campo de hora en el formulario de evento
  Pasos: test primero en `tests/unit/event-form.test.tsx` (ampliado): cambiar el inicio mueve el fin conservando la duración (1 h en un alta nueva); después de tocar el fin a mano, ya no se mueve; un fin que pasa del día queda en 23:59; al abrir el alta el foco está en Título.
  Hecho cuando: `npm test -- event-form` en verde. Cubre: RF-17, RF-18, RF-28, RF-30 | Módulo: event-form

- [x] T10 Guardar la última vista en el perfil
  Pasos: test primero en `tests/integration/profile-last-view.test.ts`: el usuario guarda y lee su `last_view`; no lee ni cambia la de otro; un valor fuera de `agenda|month|week|day` da `23514`; `list_tables_without_rls()` sigue vacía. Migración `<timestamp>_profile_last_view.sql`, `npm run db:push` (dev) y `npm run db:types`.
  Hecho cuando: `npm run test:db -- profile-last-view schema rls` en verde. Cubre: RF-25 | Módulo: last-view

- [x] T11 Abrir el calendario en la vista recordada
  Pasos: test primero en `tests/unit/ranges.test.ts` (ampliado) y `tests/unit/view-toolbar.test.tsx`: `parseViewParams` usa la vista guardada con la fecha de hoy si la URL no trae `view`, la de la URL si la trae y agenda si no hay ninguna; pulsar un botón de vista llama a `saveLastView` con esa vista. Acción `saveLastView` validada con `zod`.
  Hecho cuando: `npm test -- ranges view-toolbar` en verde. Cubre: RF-25, RF-26, RF-27 | Módulo: last-view, view-toolbar

- [x] T12 Añadir los atajos de teclado
  Pasos: test primero en `tests/unit/shortcuts.test.ts` y `tests/unit/use-calendar-shortcuts.test.tsx`: `shortcutFor` devuelve N, T, anterior, siguiente, A, M, S y D; ignora teclas con Ctrl, Alt o Meta, con el foco en un campo de texto o con un `dialog[open]`; un usuario solo Lector no tiene N. El hook navega a la URL correcta y guarda la vista. Cada botón de vista muestra su tecla (`<kbd>`, `aria-keyshortcuts`).
  Hecho cuando: `npm test -- shortcuts` en verde. Cubre: RF-31, RF-36, RF-46 | Módulo: shortcuts, view-toolbar

## Iteración 2 — crear desde la rejilla y vistas al estilo Google

- [x] T13 Calcular franjas, arrastres y la posición de la ventana rápida
  Pasos: test primero en `tests/unit/slots.test.ts` y `tests/unit/popover.test.ts`: `minuteAt` redondea a 30 min en clic y a 15 en arrastre; `clickRange(10:12)` da 10:00–11:00 y `clickRange(23:40)` da 23:30–23:59; `dragRange` ordena un arrastre hacia arriba, aplica el mínimo de 15 min y recorta a 00:00–24:00; `placePopover` coloca a la derecha del hueco, a la izquierda si no cabe y nunca fuera de la pantalla.
  Hecho cuando: `npm test -- slots popover` en verde. Cubre: RF-20, RF-30, RF-42, RF-43 | Módulo: slots, quick-create

- [x] T14 Crear la ventana rápida
  Pasos: test primero en `tests/unit/quick-create.test.tsx`: abre con el foco en el título, el día, las horas y el calendario con su color; un borrador de día completo muestra "Añadir hora", que muestra las horas; "Guardar" envía `createEvent` en modo ventana y, con `done`, cierra y avisa; "Más opciones" navega a `/dashboard/events/new` con `date`, `start`, `end`, `allDay`, `calendar` y `title`; a ≤ 768 px se pinta como hoja inferior.
  Hecho cuando: `npm test -- quick-create` en verde. Cubre: RF-28, RF-37, RF-38, RF-39, RF-41 | Módulo: quick-create

- [x] T15 Crear desde un día vacío del mes
  Pasos: test primero en `tests/unit/month-view.test.tsx` (ampliado) y `tests/unit/calendar-workspace.test.tsx`: el fondo de cada celda es un botón "Crear evento el <día>" que crea un borrador de día completo y abre la ventana rápida; el número del día sigue llevando a la vista día; el borrador se pinta en la celda con el título o "(Sin título)"; un usuario solo Lector no tiene esos botones.
  Hecho cuando: `npm test -- month-view calendar-workspace` en verde y, en el navegador, crear un evento de día completo desde el mes funciona. Cubre: RF-19, RF-21, RF-22, RF-36, RF-37, RF-40 | Módulo: month-cell, workspace, draft-block

- [x] T16 Crear con clic y arrastre en semana y día
  Pasos: test primero en `tests/unit/slot-layer.test.tsx` (eventos de puntero simulados): un clic abre la ventana rápida con la media hora y 1 h; un arrastre con ratón dibuja el bloque provisional y al soltar abre la ventana con ese intervalo; Escape durante el arrastre lo cancela; con `pointerType: "touch"` no se arrastra y el toque actúa como clic; el botón "Crear evento el <día>" se alcanza con el teclado.
  Hecho cuando: `npm test -- slot-layer` en verde y, en el navegador a 1440 px, un arrastre de 16:00 a 17:30 crea ese evento. Cubre: RF-20, RF-22, RF-40, RF-42, RF-43, RF-44, RF-45 | Módulo: slot-layer, draft-block

- [x] T17 Mostrar en el mes los eventos con punto o con barra
  Pasos: test primero en `tests/unit/event-chip.test.tsx` y `tests/unit/palette.test.ts` (ampliados): un evento con hora se pinta como punto del color + hora + título; uno de día completo o de varios días, como barra rellena del color con el texto en tinta; el contraste entre `ink` y cada color de la paleta es ≥ 4,5:1 (D9).
  Hecho cuando: `npm test -- event-chip palette design-tokens` en verde. Cubre: RF-48 | Módulo: month-chips

- [ ] T18 Hacer que la rejilla horaria ocupe el alto de la pantalla
  Pasos: test primero en `tests/unit/time-grid.test.tsx` (ampliado): la zona con desplazamiento usa la altura disponible con mínimo de 28 rem en lugar de `max-h-[28rem]`.
  Hecho cuando: `npm test -- time-grid` en verde y capturas de semana y día a 390, 768 y 1440 px revisadas. Cubre: RF-47 | Módulo: time-grid-height

- [ ] T19 Añadir "Hora actual" a la agenda
  Pasos: test primero en `tests/unit/agenda-view.test.tsx` (ampliado): el botón "Hora actual" está siempre visible; si hoy está en la agenda llama a `scrollIntoView` de la línea de la hora actual; si no, enlaza a la agenda de hoy con `#ahora`.
  Hecho cuando: `npm test -- agenda-view` en verde. Cubre: RF-23, RF-24 | Módulo: agenda-now

- [ ] T20 Mostrar un esqueleto de la vista mientras carga
  Pasos: test primero en `tests/unit/calendar-skeleton.test.tsx`: para agenda, mes, semana y día pinta la forma correspondiente con `aria-busy="true"` y el texto accesible "Cargando calendario…". La página envuelve el contenido en un `<Suspense>` con ese esqueleto según la vista de la URL.
  Hecho cuando: `npm test -- calendar-skeleton` en verde y `npm run build` sin errores de `cacheComponents`. Cubre: RF-33 | Módulo: calendar-skeleton

- [ ] T21 Actualizar los eventos al volver a la app
  Pasos: test primero en `tests/unit/use-refresh-on-focus.test.tsx`: al pasar a `visible` llama a `router.refresh()` solo si han pasado más de 60 s desde la última carga.
  Hecho cuando: `npm test -- use-refresh-on-focus` en verde. Cubre: RF-34 | Módulo: refresh-on-focus

- [ ] T22 Validar la spec RF por RF en el navegador
  Pasos: tabla RF-1 a RF-49 en este archivo con el test que lo cubre y, con `playwright-cli` sobre `npx next start -p 3100` y un usuario de prueba de dev (borrado al terminar), el recorrido de los criterios de finalización: crear con la ventana rápida, arrastrando y con el formulario completo; editar, duplicar y borrar en la ventana; atajos; recargar una URL de evento. Capturas a 390, 768 y 1440 px con los acentos rojo y amarillo. Se corrigen los fallos encontrados, cada uno con su test.
  Hecho cuando: la tabla tiene todos los RF con evidencia y el checklist de P8 completo está en verde. Cubre: todos | Módulo: validación

- [ ] T23 Actualizar la documentación
  Pasos: tras el commit del desarrollo, actualizar `AGENTS.md` (estado, funciones nuevas, rutas `@modal`, patrones y trampas), `docs/constitution.md` (enmienda de P9 de D9 y tabla de specs) y marcar el estado de spec, plan y tareas.
  Hecho cuando: `npm run format:check` en verde y commit de la documentación hecho. Cubre: todos | Módulo: documentación

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T5 |
| RF-2 | T6 |
| RF-3 | T6 |
| RF-4 | T1 |
| RF-5 | T1 |
| RF-6 | T1 |
| RF-7 | T5 |
| RF-8 | T3, T5 |
| RF-9 | T3, T5 |
| RF-10 | T1, T2 |
| RF-11 | T2, T3 |
| RF-12 | T1 |
| RF-13 | T7, T8 |
| RF-14 | T8 |
| RF-15 | T8 |
| RF-16 | T7, T8 |
| RF-17 | T7, T9 |
| RF-18 | T9 |
| RF-19 | T15 |
| RF-20 | T13, T16 |
| RF-21 | T15 |
| RF-22 | T15, T16 |
| RF-23 | T19 |
| RF-24 | T19 |
| RF-25 | T10, T11 |
| RF-26 | T11 |
| RF-27 | T11 |
| RF-28 | T9, T14 |
| RF-29 | T1 |
| RF-30 | T7, T9, T13 |
| RF-31 | T12 |
| RF-32 | T4 |
| RF-33 | T20 |
| RF-34 | T21 |
| RF-35 | T6 |
| RF-36 | T6, T12, T15 |
| RF-37 | T14, T15 |
| RF-38 | T3, T14 |
| RF-39 | T2, T14 |
| RF-40 | T15, T16 |
| RF-41 | T14 |
| RF-42 | T13, T16 |
| RF-43 | T13, T16 |
| RF-44 | T16 |
| RF-45 | T16 |
| RF-46 | T12 |
| RF-47 | T18 |
| RF-48 | T17 |
| RF-49 | T7, T8 |

## Dudas abiertas

Ninguna.
