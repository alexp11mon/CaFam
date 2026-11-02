# Tasks 019 - Escritorio, móvil y cambios al momento

> Estado: **Aprobadas** por el usuario (2026-11-02).
> Spec: `specs/019-escritorio-movil-tiempo-real/spec.md`, aprobada el 2026-11-02. Plan: `specs/019-escritorio-movil-tiempo-real/plan.md`, aprobado el 2026-11-02.
> 14 tareas en dos iteraciones:
>
> - Iteración 1 (T1–T8): cambios al momento (T1–T4), opciones de cuenta (T5–T7) y atajo C (T8).
> - Iteración 2 (T9–T14): tarjeta de detalle (T9–T11), barra plegable (T12), bloque provisional del móvil (T13) y validación (T14).
>
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si la tarea toca esquema, RLS o datos, también `npm run test:db -- <filtro>`.
> - Si toca interfaz: capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo (P9).
> - Un commit por tarea, citándola, en la rama `019-escritorio-movil-tiempo-real`.
>
> Sin dependencias nuevas (P6). Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario al cerrar.

## Tareas

### Iteración 1

- [x] T1 Añadir Supabase Realtime a la constitución (enmienda 7)
  Pasos:
  - En la línea del BaaS de `docs/constitution.md`, añadir "Supabase Realtime (Broadcast con canales privados)".
  - En P2, citar sus límites gratuitos: 200 conexiones a la vez y 2 M mensajes al mes.
  - Añadir la enmienda 7 al registro de enmiendas, con la fecha y la aprobación del plan.

  Hecho cuando: `docs/constitution.md` contiene la enmienda 7 y Realtime en la lista del BaaS, y `npm run format:check` sigue en verde. Cubre: NFR coste | Módulo: constitution

- [x] T2 Avisar por Realtime a los miembros de un calendario cuando cambia algo
  Pasos:
  - Primero, `tests/integration/live-changes.test.ts` en rojo. Usa clientes de `supabase-js` en Node con la sesión de cada usuario y canales privados. Comprueba:
    - A (miembro) recibe `changed` en `user:A` en 5 s o menos cuando B crea, cambia o borra un evento del calendario que comparten, y `actor` es B;
    - el mensaje no lleva título, horas ni ids de evento;
    - el usuario ajeno C no puede unirse a `user:A` (estado distinto de `SUBSCRIBED`) y en `user:C` no recibe nada;
    - un `update` de nombre o color del calendario avisa a A;
    - expulsar a A le avisa a él;
    - mover un evento a otro calendario avisa a los miembros de los dos;
    - un `insert` de 50 eventos en una sola transacción (`import_calendar`) manda un solo mensaje por miembro;
    - si `realtime.send` falla, el evento se guarda igual;
    - `list_tables_without_rls()` sigue vacía.
  - Después, la migración `live_changes` según "Modelo de datos" del plan.

  Hecho cuando: `npm run test:db -- live-changes schema rls` en verde y `src/types/database.ts` regenerado. Cubre: RF-40, RF-42, RF-45, RF-47 | Módulo: live-schema
  Evidencia (2026-11-02): rojo antes de la migración (6 de 7). Migración `20261102120000_live_changes.sql` aplicada en dev y tipos regenerados. `test:db -- live-changes` 7 en verde (el mensaje llega en menos de 5 s; Realtime añade su propio id a la carga) y `schema rls calendars-events merge-calendars` 105 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2153 tests. Sin test del fallo de `realtime.send` (no se puede forzar en dev): lo cubre el `exception when others` de `live_notify`.

- [x] T3 Refrescar el calendario al recibir un cambio ajeno
  Pasos:
  - Primero, tests en rojo:
    - `tests/unit/live.test.ts` para `liveDecision`: propio → `ignore`, ajeno o nulo → `refresh`, retenido → `hold`;
    - `tests/unit/use-live-calendar.test.tsx`, con el canal simulado: se suscribe solo con la pestaña visible y se da de baja al ocultarla; junta en un refresco los mensajes de 400 ms; vuelve a refrescar al pasar a `SUBSCRIBED` tras un fallo; anuncia "Calendario actualizado" en `aria-live` sin aviso emergente; llama a `realtime.setAuth()` antes de suscribirse.
  - Después, `live.ts`, `use-live-calendar.ts` y su uso en `CalendarWorkspace`.

  Hecho cuando: `npm test -- live use-live-calendar calendar-workspace` en verde. Cubre: RF-40, RF-41, RF-46, RF-48 | Módulo: live-client
  Evidencia (2026-11-02): rojo antes de implementar (imports sin resolver). `live.ts`, `live-hold.ts` y `use-live-calendar.ts`, con `userId` en el workspace y la región `aria-live` "Calendario actualizado a las HH:MM:SS". `npm test -- live use-live-calendar calendar-workspace` 30 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2165 tests.

- [x] T4 Esperar mientras se edita y cerrar lo que otro ha borrado
  Pasos:
  - Primero, tests en rojo:
    - `live-hold`: con un arrastre, la hoja rápida o el formulario de edición abiertos, el refresco espera y se hace al soltarlos;
    - `GoneEvent` tras un refresco remoto avisa "Otra persona ha borrado este evento"; tras un borrado propio, "Evento borrado".
  - Después, `live-hold.ts`, `useHoldLive` en el arrastre (`dragging`), `QuickCreate` y `EventForm` en edición, y la marca de refresco remoto que lee `GoneEvent`. La tarjeta lo usa en la T10.

  Hecho cuando: `npm test -- live-hold gone-event draggable quick-create event-form` en verde. Cubre: RF-43, RF-44 | Módulo: live-client, live-gone
  Evidencia (2026-11-02): rojo antes de implementar (4 tests). `useHoldLive` en el arrastre (`dragging`), `QuickCreate` y la edición de `EventPanel`; la marca de refresco remoto dura 3 s y `GoneEvent` la lee. `npm test -- gone-event use-hold-live event-panel quick-create draggable-event live` 61 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2170 tests.

- [x] T5 Guardar en la cuenta los fines de semana y la duración de un evento nuevo
  Pasos:
  - Primero, tests en rojo:
    - `tests/integration/view-options.test.ts`: los valores por defecto son `true` y `60`; un valor fuera de la lista da `23514`; un usuario no lee ni cambia los de otro; `visible_people()` no los expone;
    - `tests/unit/view-options.test.ts` para `visibleDays` y los esquemas;
    - `tests/unit/view-options-setting.test.tsx`: el interruptor y el selector llaman a `setShowWeekends` y `setDefaultDuration`, y muestran el error si falla.
  - Después, la migración `profile_view_options`, `getViewOptions`, las dos acciones y la sección "Calendario" de Ajustes.

  Hecho cuando: `npm run test:db -- view-options schema` y `npm test -- view-options` en verde. Cubre: RF-23, RF-24, RF-30, RF-31 | Módulo: view-options-schema, view-options, settings-ui
  Evidencia (2026-11-02): rojo antes de implementar (4 tests de BD y 2 archivos unitarios). Migración `20261102130000_profile_view_options.sql` aplicada en dev y tipos regenerados. `test:db -- view-options profile-theme schema` 56 en verde y `npm test -- view-options settings` 24. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2178 tests. Las capturas de Ajustes se hacen en la T14.

- [x] T6 Pintar semana y mes de lunes a viernes
  Pasos:
  - Primero, tests en rojo:
    - `month-lanes`: un evento de viernes a lunes en 5 columnas sale en el viernes y en el lunes siguiente; uno de sábado no sale;
    - `week-view` y `month-view` con 5 días: 5 columnas y cabeceras L–V;
    - `day-view`, la agenda y el mini calendario no cambian;
    - "Hoy" en sábado lleva a la semana L–V que contiene ese sábado;
    - `WeekendToggle` solo aparece con la opción desactivada, en la barra de vista y en el cajón, y llama a `setShowWeekends(true)`;
    - arrastrar un evento no cae fuera de las columnas visibles.
  - Después, `visibleDays` en la página, columnas con `days.length`, recorte en `layoutMonthWeek` y `WeekendToggle`.

  Hecho cuando: `npm test -- month-lanes week-view month-view day-view weekend-toggle drag` en verde y capturas a 1440 px y 390 px de semana y mes sin fines de semana. Cubre: RF-25 a RF-29 | Módulo: weekdays-views, weekend-toggle
  Evidencia (2026-11-02): rojo antes de implementar (2 tests y `weekend-toggle` sin resolver). La página filtra con `visibleDays` solo en semana y mes; el mes reparte las columnas con `days`; `layoutMonthWeek` ya recortaba por `weekDays.indexOf`. `WeekendToggle` en la barra de vista y en el cajón. `npm test -- month-lanes month-view week-view weekend-toggle view-toolbar calendar-workspace day-view drag` 122 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2186 tests. Arrastrar no puede caer en sábado ni domingo porque no hay columna (`targetAt` solo ve `data-time-col` visibles); las capturas, en la T14.

- [x] T7 Proponer la duración elegida al crear un evento
  Pasos:
  - Primero, tests en rojo:
    - `slots`: `clickRange(600, 30)` → 10:00–10:30; `clickRange(1430, 15)` → 23:50–23:59; `dragRange` no cambia;
    - `new-event-query`: con 90 min y `start=09:00` → fin 10:30, y sin `start` → 09:00 más la duración;
    - el workspace pasa la duración al clic en un hueco y "+", N y C llevan al alta con ella.
  - Después, el parámetro `duration` y su lectura en la página y en `load-new-event.ts`.

  Hecho cuando: `npm test -- slots new-event-query calendar-workspace` en verde. Cubre: RF-32, RF-33, RF-34 | Módulo: default-duration
  Evidencia (2026-11-02): rojo antes de implementar (5 tests). `clickRange(minute, duration)`, `parseNewEventQuery(…, duration)` (sin `start`, 09:00 más la duración), la duración llega de la página a `SlotLayer` por semana y día, y `loadNewEvent` la lee para "+", N, C y el alta completa. `npm test -- slots new-event-query slot-layer calendar-workspace time-grid` 72 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2194 tests.

- [x] T8 Crear un evento con la tecla C
  Pasos:
  - Primero, tests en rojo en `tests/unit/shortcuts.test.ts`:
    - C sin modificadores da `new`;
    - Ctrl+C, C escribiendo y C con un diálogo abierto no dan nada;
    - la ayuda muestra "N o C" en una sola fila.
  - Después, el cambio en `SHORTCUTS`.

  Hecho cuando: `npm test -- shortcuts shortcuts-help` en verde. Cubre: RF-49, RF-50 | Módulo: shortcut-c
  Evidencia (2026-11-02): rojo antes de implementar (2 tests). La fila de N pasa a "N o C" con `press: ["n", "c"]`, y "Nuevo evento" y "+" anuncian `aria-keyshortcuts="N C"`. `npm test -- shortcuts` 35 en verde. typecheck, format y build correctos, lint con los 2 avisos previos, `npm test` 2197 tests.

### Iteración 2

- [x] T9 Colocar la tarjeta y cargar sus datos
  Pasos:
  - Primero, tests en rojo:
    - `tests/unit/popover.test.ts` para `placeCard`: a la derecha si cabe, si no a la izquierda, si no encima o debajo según el sitio, siempre dentro de la pantalla;
    - `tests/unit/card-actions.test.ts` (Node, Supabase simulado) para `loadEventCard`: descripción, autor (incluidos "Cuenta borrada" y "un antiguo miembro"), resumen de la repetición, motivo de solo lectura con su proveedor, `canEdit` de un Lector, `{gone: true}` con un id ajeno, borrado o mal formado.
  - Después, `placeCard` y `card-actions.ts`, reutilizando lo que ya hace `loadEvent`.

  Hecho cuando: `npm test -- popover card-actions` en verde. Cubre: RF-2, RF-4, RF-5, RF-7 | Módulo: event-card, card-loader
  Evidencia (2026-11-02): rojo antes de implementar (4 tests de `placeCard` y `card-actions` sin resolver). `placeCard` en `popover.ts` y `loadEventCard` en `card-actions.ts`, que reutiliza `getEvent`, `getCalendar`, `getMembers`, `authorLabel`, `readOnlyReason` y `canWriteEvents`. `npm test -- popover card-actions` 12 en verde. typecheck, format y build correctos, lint con los 2 avisos previos.

- [ ] T10 Abrir la tarjeta de detalle al pulsar un evento en el ordenador
  Pasos:
  - Primero, `tests/unit/event-card.test.tsx` en rojo. Comprueba:
    - a 769 px o más, un clic abre la tarjeta y no navega; Ctrl+clic navega; a 768 px o menos, la hoja de siempre;
    - la tarjeta es un diálogo no modal con el título como nombre, sin fondo, y la página sigue sin estar inerte;
    - muestra color, título, horas o "Todo el día", lugar, calendario y contadores al momento, y después la descripción (3 líneas), el autor y la repetición;
    - pulsar otro evento la mueve;
    - Escape, Cerrar y un clic fuera la cierran y devuelven el foco al bloque;
    - se cierra al bajar de 769 px;
    - si un refresco remoto quita el evento, se cierra con "Otra persona ha borrado este evento";
    - una recarga o un enlace a `/dashboard/events/[id]` siguen en página completa.
  - Después, `EventCard`, `openCard` en `EventInteractions` y la captura del clic.

  Hecho cuando: `npm test -- event-card event-block draggable-event` en verde y capturas de la tarjeta a 1440 px (derecha, izquierda y encima) en claro y oscuro con el acento rojo y el amarillo. Cubre: RF-1, RF-3, RF-6, RF-11, RF-12, RF-13, RF-15, RF-16, RF-44 | Módulo: event-card, card-open, live-gone

- [ ] T11 Editar, duplicar, borrar y abrir desde la tarjeta
  Pasos:
  - Primero, tests en rojo:
    - Editar va a `?edit=1` y la ventana abre en edición;
    - Duplicar va a `/dashboard/events/new?from=`;
    - Borrar llama a `deleteForUndo`, cierra y avisa con "Deshacer", y en una repetición pregunta antes el alcance;
    - "Abrir" va al detalle completo, también para un Lector;
    - un Lector o un calendario traído de solo lectura no ven Editar ni Borrar, y sí el motivo;
    - E, Supr y Ctrl+C funcionan con el foco en la tarjeta.
  - Después, los botones, `edit-from-url` en `EventPanel` y los atajos.

  Hecho cuando: `npm test -- event-card event-panel` en verde. Cubre: RF-7, RF-8, RF-9, RF-10, RF-14 | Módulo: event-card, edit-from-url

- [ ] T12 Plegar la barra lateral del calendario
  Pasos:
  - Primero, tests en rojo:
    - `use-sidebar-collapsed`: lee y escribe `cafam-sidebar`, y sin `localStorage` no falla;
    - workspace: el botón solo existe desde 1024 px, con `aria-expanded` y el nombre "Plegar el panel" o "Desplegar el panel"; plegado, la columna desaparece y el título lleva una flecha que abre el mini calendario; elegir un día navega y lo cierra.
  - Después, el hook, el botón en `ViewToolbar` y el mini calendario flotante.

  Hecho cuando: `npm test -- use-sidebar-collapsed calendar-workspace view-toolbar` en verde y capturas a 1440 px con la barra plegada y desplegada. Cubre: RF-17 a RF-22 | Módulo: sidebar-collapse

- [ ] T13 Alargar y mover el bloque provisional en el móvil
  Pasos:
  - Primero, tests en rojo:
    - `tests/unit/draft-drag.test.ts`: pasos de 15 min, conservar la duración al mover, mínimo de 15 min, dentro de 00:00–23:59;
    - `time-grid` y `quick-create` a 390 px: el tirador solo aparece con la hoja abierta en semana o día; arrastrar el tirador o el bloque cambia las horas de la hoja; cambiar las horas en la hoja mueve el bloque; al abrir, el bloque queda por encima de la hoja.
  - Después, `draft-drag.ts`, `use-draft-drag.ts`, `onDraftChange` en `QuickCreate` y el tirador.

  Hecho cuando: `npm test -- draft-drag time-grid quick-create` en verde y prueba con emulación táctil en `playwright-cli` a 390 px. Cubre: RF-35 a RF-39 | Módulo: draft-adjust

- [ ] T14 Validar la spec de principio a fin
  Pasos:
  - Verificación completa (P8), con `test:db`.
  - Prueba con dos navegadores y dos usuarios del mismo calendario, más un usuario ajeno: crear, mover y borrar 20 veces. Anotar el tiempo de cada cambio y el percentil 95 (RF-41). El ajeno no recibe nada.
  - Capturas a 390, 768 y 1440 px (acentos rojo y amarillo, claro y oscuro): tarjeta, barra plegada, sin fines de semana y bloque provisional.
  - Tabla de trazabilidad con la evidencia, y actualizar AGENTS.md.

  Hecho cuando: verificación en verde con la salida reportada, percentil 95 de 5 s o menos y evidencias en este archivo. Cubre: todos | Módulo: validation

## Trazabilidad RF → tareas

| RF | Tareas |
|----|--------|
| RF-1 | T10 |
| RF-2 | T9, T10 |
| RF-3 | T10 |
| RF-4, RF-5 | T9, T10 |
| RF-6 | T10 |
| RF-7 | T9, T11 |
| RF-8, RF-9, RF-10 | T11 |
| RF-11, RF-12, RF-13 | T10 |
| RF-14 | T11 |
| RF-15, RF-16 | T10 |
| RF-17 a RF-22 | T12 |
| RF-23, RF-24 | T5 |
| RF-25 a RF-29 | T6 |
| RF-30, RF-31 | T5 |
| RF-32, RF-33, RF-34 | T7 |
| RF-35 a RF-39 | T13 |
| RF-40 | T2, T3 |
| RF-41 | T3, T14 |
| RF-42 | T2 |
| RF-43 | T4 |
| RF-44 | T4, T10 |
| RF-45 | T2 |
| RF-46 | T3 |
| RF-47 | T2, T14 |
| RF-48 | T3 |
| RF-49, RF-50 | T8 |
| NFR coste | T1, T2 |

## Dudas abiertas

Ninguna.
