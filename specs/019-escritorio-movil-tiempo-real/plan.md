# Plan 019 — Escritorio, móvil y cambios al momento

Spec de origen: `specs/019-escritorio-movil-tiempo-real/spec.md`, aprobada por el usuario el 2026-11-02 al pedir este plan. Constitución: `docs/constitution.md`.

> Estado: **Aprobado** por el usuario el 2026-11-02, con la enmienda 7.

Sin dependencias nuevas (P6): Supabase Realtime viene dentro de `@supabase/supabase-js` 2.118, que ya está instalado. La constitución, en cambio, nombra uno a uno los servicios de Supabase permitidos y Realtime no está entre ellos. Hace falta la **enmienda 7**, que se aplica en la T1 (D1).

## Resumen de arquitectura

- **Lo que se ve (cliente).** Desde 769 px, la tarjeta de detalle (`EventCard`) sustituye a la ventana interceptada al pulsar un evento. Se abre al momento con los datos que ya tiene la vista y completa lo que falta con una acción de solo lectura. La barra plegable usa estado del dispositivo (`localStorage`). El bloque provisional del móvil pasa a estar controlado por el borrador del workspace, que ya existe (`Draft`). El atajo C es una tecla más en `SHORTCUTS`.
- **Preferencias de cuenta (servidor).** Dos columnas nuevas en `profiles`: `show_weekends` y `default_event_minutes`. Se leen en la página del calendario y en el alta. Los días que se pintan se filtran con una función pura; la consulta no cambia.
- **Cambios al momento.** Patrón "señal y relectura": los triggers de `events`, `calendars` y `calendar_members` envían con `realtime.send` un mensaje **privado** al tema `user:<id>` de cada miembro del calendario. El mensaje solo lleva quién hizo el cambio, nunca datos del evento. El navegador, al recibirlo, espera un momento, junta los mensajes y hace `router.refresh()`. La relectura pasa por RLS como siempre. Solo puede escuchar `user:<id>` el propio usuario (política en `realtime.messages`).

```
Clic en evento (≥769 px) ─▶ EventCard (datos de la vista, <100 ms) ─▶ loadEventCard(id) ─▶ descripción, autor, repetición, permisos
        ├ Editar ─▶ /dashboard/events/[id]?edit=1 (ventana de siempre, en edición)
        ├ Abrir  ─▶ /dashboard/events/[id] (ventana de siempre)
        └ Borrar ─▶ deleteForUndo (+ SeriesScopeChoice) ─▶ aviso "Deshacer" (spec 017)

INSERT/UPDATE/DELETE en events · calendars · calendar_members
        └▶ trigger live_notify ─ una vez por calendario y transacción ─▶ realtime.send({actor}, 'changed', 'user:<miembro>', private)
                                                                             │ (RLS de realtime.messages: solo el propio usuario)
navegador: useLiveCalendar ─ canal privado user:<yo>, solo con la pestaña visible
        └▶ actor ≠ yo ─▶ espera 400 ms ─▶ ¿retenido (arrastre, alta rápida, edición)? ─ sí ─▶ al soltar
                                                                        └ no ─▶ router.refresh() + aria-live
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `constitution` | `docs/constitution.md` | Enmienda 7: añade Supabase Realtime (Broadcast con canales privados) a la lista de servicios del BaaS, con sus límites gratuitos | No cambia ningún principio | NFR coste |
| `view-options-schema` | `supabase/migrations/<ts>_profile_view_options.sql` | `profiles.show_weekends boolean not null default true` y `profiles.default_event_minutes smallint not null default 60 check (… in (15,30,45,60,90,120))`, protegidas por las políticas de `profiles` | No toca otras tablas | RF-23, RF-24, RF-30, RF-31 |
| `view-options` | `src/lib/calendar/view-options.ts` (pura); `getViewOptions` en `queries.ts`; `setShowWeekends` y `setDefaultDuration` en `settings/actions.ts` | `DURATIONS`, `visibleDays(days, showWeekends)` (quita sábado y domingo), validación `zod` de los dos valores y lectura y escritura en `profiles` con `revalidatePath("/dashboard", "layout")` | No pinta | RF-23 a RF-27, RF-30, RF-31 |
| `settings-ui` | `src/components/settings/view-options-setting.tsx`, `settings/page.tsx` | Sección "Calendario" en Ajustes: interruptor "Mostrar fines de semana" y selector "Duración de un evento nuevo" | — | RF-23, RF-30 |
| `weekdays-views` | `time-grid.tsx`, `week-view.tsx`, `month-view.tsx`, `src/lib/calendar/month-lanes.ts`, `calendar/page.tsx`, `calendar-workspace.tsx` | La página pasa `visibleDays` a semana y mes. La rejilla y el mes reparten las columnas con `days.length` en lugar de un 7 fijo. `layoutMonthWeek` recorta los eventos de varios días a las columnas visibles. Día, agenda y mini calendario reciben los días de siempre | No cambia la consulta ni la navegación (±7 días) | RF-25 a RF-27, RF-29 |
| `weekend-toggle` | `src/components/calendar/weekend-toggle.tsx`, `view-toolbar.tsx`, cajón (`DrawerViews`) | Solo con la opción desactivada: botón "Mostrar fines de semana" que llama a `setShowWeekends(true)` | — | RF-28 |
| `default-duration` | `slots.ts` (`clickRange(minute, duration)`), `new-event-query.ts` (`parseNewEventQuery(…, duration)`), `load-new-event.ts`, `calendar-workspace.tsx` | El clic o toque en un hueco, "+", N, C y el alta completa proponen `inicio + duración`, como mucho hasta las 23:59 (`clampEnd`). `dragRange` no cambia | — | RF-32 a RF-34 |
| `event-card` | `src/components/calendar/event-card.tsx`, `src/lib/calendar/popover.ts` (`placeCard`) | `<dialog>` **no modal** (`show()`): sin fondo y sin bloquear la página. Muestra color, título, fecha y horas, lugar, calendario, contadores de imágenes y comentarios, y después la descripción (3 líneas con `line-clamp-3`), el autor y la repetición. Botones Editar, Duplicar y Borrar si se puede escribir, motivo de solo lectura si no, y siempre "Abrir" y Cerrar. Escape, clic fuera, foco al abrir y vuelta al evento al cerrar, y atajos E, Supr y Ctrl+C. Se cierra si la ventana baja de 769 px. Entra con `@starting-style` en 400 ms como mucho | No edita en la tarjeta | RF-1 a RF-14, NFR accesibilidad y movimiento |
| `card-loader` | `src/app/dashboard/events/card-actions.ts` (`loadEventCard`) | Acción de solo lectura: con `getEvent` y `getCalendar` (RLS) devuelve `{description, author, repeat, readOnly, provider, canEdit}`, o `{gone: true}` | No carga imágenes ni comentarios | RF-4 a RF-7 |
| `card-open` | `event-block.tsx` / `draggable-event.tsx`, `event-interactions.tsx` | Un clic izquierdo sin modificadores en un evento, desde 769 px y con la API de la tarjeta en el contexto, hace `preventDefault` y abre o mueve la tarjeta. Ctrl o clic central siguen abriendo el enlace. En el móvil, la hoja de siempre | — | RF-1, RF-12, RF-15, RF-16 |
| `edit-from-url` | `event-panel.tsx`, `@modal/(.)events/[id]/page.tsx`, `events/[id]/page.tsx` | `?edit=1` abre el detalle ya en modo edición (lo hace hoy la tecla E) | — | RF-9 |
| `sidebar-collapse` | `src/lib/hooks/use-sidebar-collapsed.ts`, `calendar-workspace.tsx`, `view-toolbar.tsx` | Estado del dispositivo en `localStorage` `cafam-sidebar` (con `try/catch` y `useSyncExternalStore`). Desde 1024 px, un botón ≡ en la barra de vista con `aria-expanded`, `aria-controls` y el nombre "Plegar el panel" o "Desplegar el panel". Plegado: la columna `lg:w-84` desaparece y el título gana una flecha que despliega el mini calendario en un panel flotante. Elegir un día lo cierra | No afecta a la barra de iconos de la app (`SideRail`) | RF-17 a RF-22 |
| `draft-adjust` | `src/lib/calendar/draft-drag.ts` (pura), `src/lib/hooks/use-draft-drag.ts`, `time-grid.tsx`, `quick-create.tsx` | El borrador es la única fuente de las horas: `QuickCreate` lee inicio y fin de `draft` y avisa con `onDraftChange`. Hasta 768 px, el bloque provisional lleva `touch-none` y un tirador en el borde inferior. Arrastrar el bloque mueve el inicio conservando la duración y arrastrar el tirador cambia el fin, siempre en pasos de 15 min, con un mínimo de 15 min y dentro del día. Cambiar las horas en la hoja mueve el bloque | No guarda nada | RF-35 a RF-39 |
| `live-schema` | `supabase/migrations/<ts>_live_changes.sql` | `live_notify(p_calendar_id, p_extra_user)`, `SECURITY DEFINER` con `search_path = ''`: envía una vez por calendario y transacción (marca con `set_config(..., true)`) un `realtime.send(jsonb_build_object('actor', auth.uid()), 'changed', 'user:' \|\| miembro, true)` a cada miembro y, si se pasa, a `p_extra_user`. Triggers `AFTER` de fila en `events` (calendario viejo y nuevo), `calendars` (update y delete) y `calendar_members` (insert, update y delete, más el usuario que sale). Política de `select` en `realtime.messages` para `authenticated`: `realtime.topic() = 'user:' \|\| auth.uid()` | No lleva ningún dato del evento ni del calendario | RF-40, RF-42, RF-45, RF-47 |
| `live-client` | `src/lib/hooks/use-live-calendar.ts`, `src/lib/calendar/live.ts` (pura: decide refrescar, esperar o retener), `src/lib/calendar/live-hold.ts` (almacén de retenciones) | En el workspace, con la pestaña visible: `supabase.realtime.setAuth()` y canal privado `user:<yo>`. Al ocultarse la pestaña, `removeChannel`. Un mensaje con `actor` distinto del usuario (o nulo, de la sincronización) espera 400 ms juntando los que lleguen y hace `router.refresh()`. Mientras haya una retención (arrastre, alta rápida o formulario de edición abiertos), espera a que se suelte. Si el canal vuelve a `SUBSCRIBED` tras un fallo, refresca una vez. Anuncia "Calendario actualizado" en la región `aria-live` de `EventInteractions` | No muestra avisos emergentes | RF-40, RF-41, RF-43, RF-46, RF-48 |
| `live-gone` | `gone-event.tsx`, `event-card.tsx` | Si un refresco remoto deja fuera el evento de la tarjeta, o la ventana interceptada pinta `GoneEvent`, se cierra con el aviso "Otra persona ha borrado este evento". El borrado propio sigue avisando "Evento borrado" | — | RF-44 |
| `shortcut-c` | `src/lib/calendar/shortcuts.ts` | La fila de N pasa a `keys: "N o C"` con `press: ["n", "c"]` | — | RF-49, RF-50 |
| `validation` | `tests/integration/view-options.test.ts`, `tests/integration/live-changes.test.ts`, tests unitarios, capturas y prueba con dos navegadores | Matriz de permisos de Realtime, latencia y pruebas manuales de la spec | — | todos |

## Modelo de datos

### `public.profiles` (migración `profile_view_options`)

| Columna | Tipo | Notas |
|---------|------|-------|
| `show_weekends` | `boolean not null default true` | RF-23. Solo la lee y escribe el propio usuario (políticas actuales) |
| `default_event_minutes` | `smallint not null default 60`, `check (default_event_minutes in (15, 30, 45, 60, 90, 120))` | RF-30 |

`visible_people()`, `calendar_members_with_names` y `assistant_people()` no las exponen.

### Mensajes de Realtime (migración `live_changes`)

- Tema: `user:<uuid>`, privado. Evento: `changed`. Carga: `{"actor": "<uuid>" | null}`.
- `realtime.messages` es de Supabase: se le añade una política, no columnas. Los mensajes caducan solos (Supabase borra las particiones antiguas).
- Deduplicación por transacción: `set_config('cafam_live.c' || replace(id::text, '-', ''), '1', true)`. Una sincronización que trae 300 eventos de un calendario manda **un** mensaje por miembro (caso límite "Muchos cambios seguidos").
- `events` cuando cambia `calendar_id` (mover o juntar): avisa a los dos calendarios. `calendar_members` delete: avisa también a `old.user_id`, que ya no es miembro (RF-45). Borrar un calendario: el borrado en cascada de los miembros avisa a cada uno.

### Estado del cliente (sin servidor)

- `localStorage` `cafam-sidebar` = `"collapsed"` o nada (RF-21).
- Retenciones del refresco: contador en memoria (`live-hold.ts`). `useHoldLive(active)` lo usan el arrastre (`dragging` del contexto), `QuickCreate` y `EventForm` en edición.

## Contratos e interfaces

### Server Actions

- `setShowWeekends(show: boolean): Promise<Result>` y `setDefaultDuration(minutes: number): Promise<Result>` (`settings/actions.ts`, mismo `Result` que `setTheme`). Validan con `zod`: un valor fuera de la lista devuelve `{ ok: false, error }` y no escribe.
- `loadEventCard(id: string): Promise<EventCardData | { gone: true }>`, con `EventCardData = { description: string | null; author: string; repeat: EventDetailData["repeat"]; readOnly: ReadOnlyReason | null; provider?: ProviderName; canEdit: boolean }`. El id se valida con `parseEventId`.

### Funciones puras

- `visibleDays(days: string[], showWeekends: boolean): string[]`.
- `clickRange(minute: number, duration = 60): MinuteRange`.
- `parseNewEventQuery(query, ids, today, duration = 60)`.
- `placeCard(anchor: Box, size, viewport): { left, top, side: "right" | "left" | "above" | "below" }`: derecha si cabe entera, luego izquierda, luego encima o debajo (donde haya más sitio), siempre dentro de la pantalla. `placePopover` no cambia.
- `moveDraft(draft, deltaMinutes)` y `resizeDraft(draft, endMinute)` (`draft-drag.ts`): pasos de 15, duración mínima de 15 y dentro de [0, 23:59].
- `liveDecision({ actor, me, held }): "ignore" | "hold" | "refresh"` (`live.ts`).

### Componentes

- `EventCard({ event: AgendaEvent, anchor: HTMLElement, canEdit, timeZone, onClose })`, abierta desde `useEventInteractions().openCard(event, element)`.
- `WeekendToggle({ show: boolean })`.
- `QuickCreate`: nuevo `onDraftChange(next: Draft)`; las horas salen de `draft`.

### Realtime (cliente)

```
supabase.channel(`user:${userId}`, { config: { private: true } })
  .on("broadcast", { event: "changed" }, ({ payload }) => …)
  .subscribe((status) => …)
```

## Flujo principal paso a paso

1. **Ver un evento en el ordenador.** Clic en un bloque de la semana (RF-1) → `card-open` intercepta el clic del enlace → `EventCard` se pinta con el `AgendaEvent` de la vista y `placeCard` (RF-2), con `show()` no modal (RF-3), y enfoca el título (RF-13) → `loadEventCard` completa descripción, autor y repetición (RF-4, RF-5). Los contadores salen de la vista (RF-6) → Editar (RF-9) lleva a `/dashboard/events/[id]?edit=1`, Borrar (RF-10) llama a `deleteForUndo` con el aviso "Deshacer", y "Abrir" (RF-8) lleva a la ventana de siempre → Escape o clic fuera la cierran y el foco vuelve al bloque (RF-11, RF-13).
2. **Plegar la barra.** ≡ (RF-17, RF-22) → `localStorage` (RF-21) → la vista ocupa el ancho (RF-18) → la flecha del título abre el mini calendario (RF-19) → elegir un día navega y lo cierra (RF-20).
3. **Sin fines de semana.** Ajustes → `setShowWeekends(false)` (RF-23, RF-24) → la página filtra con `visibleDays` para semana y mes (RF-25, RF-26), recorta los eventos de varios días (RF-29) y deja día, agenda y mini calendario como están (RF-27) → la barra de vista y el cajón ofrecen "Mostrar fines de semana" (RF-28).
4. **Crear con la duración elegida.** Toque a las 10:00 con 30 min (RF-32) → `clickRange(600, 30)` → 10:00–10:30. A las 23:50 con 15 min → 23:59 (RF-33). Si se arrastra un intervalo, se usa ese (RF-34).
5. **Ajustar el bloque en el móvil.** Toque en un hueco de la semana → hoja rápida y bloque con tirador (RF-35) → arrastrar el tirador cambia el fin (RF-36) → arrastrar el bloque mueve el inicio (RF-37), nunca por debajo de 15 min (RF-38) → cambiar la hora en la hoja mueve el bloque (RF-39).
6. **Cambio de otro familiar.** B mueve un evento → `update` de `events` → `live_notify` → `realtime.send` a `user:A` y a `user:B` (RF-40). Para B, `actor = B` → ignora. Para A → espera 400 ms → `router.refresh()` → la vista cambia en ≤ 5 s (RF-41) y se anuncia en `aria-live` sin aviso emergente (RF-48). Si A estaba arrastrando, el refresco espera a que suelte (RF-43). Un usuario ajeno no puede unirse a `user:A` (RF-47).
7. **Borrado ajeno con la tarjeta abierta.** Tras el refresco remoto el evento ya no está en `events` → la tarjeta se cierra con "Otra persona ha borrado este evento". En la ventana, `GoneEvent` hace lo mismo (RF-44).
8. **Reconexión.** El canal pasa a `CHANNEL_ERROR` o `CLOSED` → realtime-js reconecta solo → al volver a `SUBSCRIBED`, un `router.refresh()` recupera lo perdido (RF-46).

## Decisiones técnicas

- D1: Supabase Realtime (Broadcast desde la base de datos con `realtime.send` y canales privados), con la enmienda 7. Descartado el sondeo cada 5 s: con 20 pestañas abiertas son 345.600 lecturas completas al día. Motivo: viene en el plan Free (200 conexiones a la vez, 2 M mensajes al mes, 100 mensajes por segundo) y sin dependencias nuevas. Cubre: RF-40, RF-41.
- D2: "Señal y relectura": el mensaje no lleva datos y el cliente relee con `router.refresh()`. Descartado `postgres_changes`: Supabase no aplica RLS a los `DELETE`, así que mandaría el id de un evento borrado a quien no lo ve, y además relee los permisos por cada fila y suscriptor. Motivo: la relectura pasa por la RLS de siempre y la carga del mensaje no revela nada. Cubre: RF-47, RF-40, RF-42.
- D3: Un tema por usuario (`user:<id>`), al que el trigger reparte por miembro. Descartado un tema por calendario: obliga a abrir un canal por calendario y a autorizar con `is_calendar_member` sobre un texto. Motivo: un solo canal por pestaña y una política de una línea. Además, la expulsión (RF-45) llega al expulsado. Cubre: RF-45, RF-47.
- D4: Deduplicar por calendario y transacción con `set_config` local. Descartados los triggers por sentencia con tablas de transición: Postgres no los admite con varios eventos por trigger y harían falta seis. Motivo: un solo trigger por tabla y un mensaje por sincronización. Cubre: casos límite, NFR coste.
- D5: Ignorar en el cliente los mensajes de uno mismo (`actor`). Descartado no mandárselos desde SQL: las escrituras propias desde otra pestaña o dispositivo sí deben llegar. Motivo: la pestaña que hizo el cambio ya refresca sola. Shortcut aceptado: otra pestaña del mismo usuario no refresca (mismo `actor`) hasta volver a la pestaña. Cubre: RF-40, RF-48.
- D6: Retener el refresco mientras se arrastra, se crea o se edita, y aplicarlo al terminar. Descartado refrescar siempre: el formulario conserva lo escrito (campos no controlados), pero el arrastre y el bloque provisional se recolocarían. Cubre: RF-43.
- D7: Canal solo con la pestaña visible y refresco al volver con `useRefreshOnFocus`, que ya existe. Descartado mantenerlo siempre: gasta conexiones del plan y batería sin que nadie mire. Cubre: RF-40, caso límite de la pestaña oculta.
- D8: La tarjeta es un `<dialog>` abierto con `show()` (no modal). Descartado un `div` con `role="dialog"`: `use-calendar-shortcuts` ya calla con `dialog[open]` y el lector de pantalla lo anuncia como diálogo. Motivo: no tapa ni vuelve inerte la página (RF-3). Escape y clic fuera los atiende el componente, porque un diálogo no modal no tiene `cancel`. Cubre: RF-3, RF-11, RF-14.
- D9: La tarjeta abre con los datos de la vista y pide el resto con `loadEventCard`. Descartado añadir descripción y autor a `getEventsInRange`: cargaría hasta 2.000 caracteres por evento en cada vista. Motivo: abre en menos de 100 ms y el resto llega después. Cubre: RF-4, RF-5, NFR rendimiento.
- D10: Editar desde la tarjeta navega a `?edit=1`. Descartado un formulario dentro de la tarjeta: duplicaría `EventForm` y el alcance de las series. Motivo: reutiliza la ventana de la 008 tal cual. Cubre: RF-9.
- D11: Fines de semana filtrando los días en el cliente, con la misma consulta de 7 días. Descartado cambiar `getVisibleRange`: rompería la navegación ±7, "Hoy" en sábado y el mini calendario. Motivo: un solo punto, `visibleDays`. Cubre: RF-25 a RF-27, caso límite "Hoy es sábado".
- D12: Barra plegada en `localStorage` con `useSyncExternalStore`, como el zoom de la 017. Descartado guardarla en `profiles`: la spec la pide por dispositivo. Cubre: RF-21.
- D13: El borrador manda sobre las horas de `QuickCreate`. Descartado sincronizar dos estados con efectos: lo prohíbe la regla `set-state-in-effect` y se desfasan. Cubre: RF-36, RF-37, RF-39.

### Límites del plan Free y cómo no pasarse (NFR coste)

- Conexiones: una por pestaña visible del calendario, de las 200. Para decenas de usuarios hay margen de sobra.
- Mensajes: con 30 usuarios, 300 cambios al día y 6 miembros de media por calendario, salen unos 1.800 al día más uno por actualización de sincronización y miembro, unos 3.000. Al mes son unos 90.000 de 2 M (4,5 %). Cuentan los que Supabase entrega a cada suscriptor; los que van a usuarios desconectados no se entregan.
- La deduplicación por transacción (D4) evita que una sincronización o una fusión manden un mensaje por fila.

## Trazabilidad RF → módulo

| RF | Módulos |
|----|---------|
| RF-1 | event-card, card-open |
| RF-2 | event-card (`placeCard`) |
| RF-3 | event-card (D8) |
| RF-4, RF-5 | event-card, card-loader |
| RF-6 | event-card (contadores de la vista) |
| RF-7 | event-card, card-loader |
| RF-8 | event-card |
| RF-9 | event-card, edit-from-url |
| RF-10 | event-card (`deleteForUndo`, `SeriesScopeChoice`) |
| RF-11, RF-13, RF-14 | event-card |
| RF-12 | card-open |
| RF-15, RF-16 | card-open (solo intercepta desde 769 px y en un clic dentro de la app) |
| RF-17 a RF-22 | sidebar-collapse |
| RF-23, RF-24 | view-options-schema, view-options, settings-ui |
| RF-25, RF-26, RF-27, RF-29 | view-options, weekdays-views |
| RF-28 | weekend-toggle |
| RF-30, RF-31 | view-options-schema, view-options, settings-ui |
| RF-32, RF-33, RF-34 | default-duration |
| RF-35 a RF-39 | draft-adjust |
| RF-40 | live-schema, live-client |
| RF-41 | live-client (espera de 400 ms), validation (medida) |
| RF-42 | live-schema (triggers de `calendars` y `calendar_members`) |
| RF-43 | live-client (retenciones) |
| RF-44 | live-gone |
| RF-45 | live-schema (aviso al que sale) |
| RF-46 | live-client |
| RF-47 | live-schema (política y carga sin datos), validation |
| RF-48 | live-client |
| RF-49, RF-50 | shortcut-c |

## Riesgos y mitigaciones

- R1: `realtime.send` o los canales privados no están disponibles en el proyecto o fallan al llamarlos desde un trigger. Mitigación: la T2 lo comprueba primero en dev con un test que se une al canal. `live_notify` atrapa cualquier error (`exception when others`), así que un fallo de Realtime nunca impide guardar un evento. En ese caso se ve como hoy: al volver a la pestaña.
- R2: Con `@supabase/ssr`, el cliente del navegador tiene que pasar el JWT a Realtime para los canales privados. Mitigación: `await supabase.realtime.setAuth()` antes de suscribirse y otra vez en `onAuthStateChange` (`TOKEN_REFRESHED`).
- R3: `router.refresh()` repinta toda la ruta (incluida la ventana interceptada). Mitigación: las vistas ya conservan su estado (agenda con tramos, cambios optimistas), la tarjeta vive en el contexto del cliente y las retenciones evitan refrescar mientras se edita. La spec pide "no recargar la página": `refresh` no recarga ni pierde el desplazamiento.
- R4: La hoja rápida del móvil tapa la mitad inferior de la rejilla y el bloque puede quedar debajo. Mitigación: al abrirla, la rejilla se desplaza para que el bloque quede encima de la hoja (`scrollTop`, no `scrollIntoView`; trampa conocida).
- R5: La tarjeta sobre un evento de la franja de día completo o del mes queda en un ancla estrecha. Mitigación: `placeCard` prueba también encima y debajo, y se comprueba en las capturas.
- R6: Ocultar los fines de semana con la fecha en sábado. Mitigación: `weekStart` no cambia, así que la semana sigue siendo la de esa fecha. Arrastrar al borde de una semana de 5 días no salta al fin de semana, porque no hay columna. Test en `visibleDays` y en el arrastre.
- R7: Latencia real de más de 5 s. Mitigación: la T13 lo mide con dos navegadores (20 cambios y el percentil 95) y lo deja en la evidencia.

## Dudas abiertas

Ninguna bloqueante. La enmienda 7 de la constitución (D1) se aprueba con este plan.
