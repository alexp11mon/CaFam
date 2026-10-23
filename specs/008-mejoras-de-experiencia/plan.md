# Plan 008 — Mejoras de experiencia de uso

> Estado: **Aprobado** por el usuario (2026-10-23), incluida la enmienda de P9 (D9).
> Spec de origen: `specs/008-mejoras-de-experiencia/spec.md` (aprobada el 2026-10-22 y ampliada el 2026-10-23 tras el análisis `analisis-google-calendar.md`). Constitución: `docs/constitution.md` (P3, P6, P8, P9). Parte del código de las specs 002, 005 y 006.

## Resumen de arquitectura

Mismo monolito Next.js 16 + Supabase con RLS, **sin dependencias nuevas** (NF-4).

- **Ventana de evento con rutas interceptadas** (decisión del usuario): un slot paralelo `@modal` en `src/app/dashboard/` intercepta `/dashboard/events/new` y `/dashboard/events/[id]` cuando se llega navegando dentro de la app. El calendario queda detrás y la URL cambia; al recargar o abrir el enlace se ve la página completa de siempre (RF-10). Las páginas y las Server Actions existentes se reutilizan.
- **Alta rápida y arrastre en el cliente:** el `CalendarWorkspace` (ya es Client Component) guarda un "borrador" (día, inicio, fin, día completo) que pintan las vistas como bloque provisional y que abre una ventana rápida anclada al hueco. "Guardar" usa la misma acción `createEvent`; "Más opciones" navega a `/dashboard/events/new?…` con lo escrito, que se abre en la ventana grande.
- **Lógica pura testeada en `lib/calendar`:** horas y duraciones, conversión de posición a minutos, colocación de la ventana rápida y filtro de atajos. Los componentes solo pintan.
- **Un cambio de base de datos:** `profiles.last_view` para la vista recordada (RF-25), protegida por las políticas de `profiles` que ya existen.

```
/dashboard/layout.tsx ── AppFrame (acento) ── {children} + {modal} + <ToastRegion>
   ├ children: /dashboard/calendar ─ ViewShell (lee ?view) ─ <Suspense fallback=CalendarSkeleton(view)>
   │                                   └ CalendarContent ─ ViewToolbar (atajos) + CalendarWorkspace
   │                                         ├ AgendaView ("Hora actual") | MonthView | WeekView/DayView (TimeGrid + SlotLayer)
   │                                         ├ borrador → bloque provisional + QuickCreate (dialog anclado / hoja inferior)
   │                                         └ useCalendarShortcuts · useRefreshOnFocus
   └ @modal: default.tsx (null) · (.)events/new · (.)events/[id]  ── EventModal (<dialog>, pantalla completa)
                                                                     └ EventForm (TimeField) | EventPanel (detalle ↔ edición)
Server Actions: createEvent · updateEvent · deleteEvent (+ modo "modal": devuelven estado en vez de redirect) · saveLastView
Supabase: profiles.last_view (check en agenda|month|week|day, nulo = sin guardar)
```

## Módulos y responsabilidades

| Módulo | Ubicación | Qué hace | Qué no hace | RF |
|--------|-----------|----------|-------------|----|
| `modal-routes` | `src/app/dashboard/@modal/default.tsx`, `@modal/(.)events/new/page.tsx`, `@modal/(.)events/[id]/page.tsx`, `src/app/dashboard/layout.tsx` | Slot paralelo: `default` devuelve `null`; las rutas interceptadas cargan los mismos datos que las páginas completas (extraídos a funciones de carga compartidas) y los pintan dentro de `EventModal`. El layout recibe `modal` y lo pinta dentro de `AppFrame` | No cambia las páginas completas, que siguen sirviendo la recarga y los enlaces | RF-1, RF-2, RF-10, RF-11 |
| `event-loaders` | `src/app/dashboard/events/load-new-event.ts`, `load-event.ts` | Lógica de servidor compartida por la página completa y la interceptada: calendarios editables, categorías, valores iniciales del alta (incluidos `start`, `end`, `allDay`, `title` y `from` de la URL) y detalle del evento | No pinta | RF-10, RF-11, RF-35, RF-39 |
| `event-modal` | `src/components/calendar/event-modal.tsx` | `<dialog>` modal (foco atrapado, Escape, fondo atenuado) con título anunciado, "Cerrar" y botón de pantalla completa. A ≤ 768 px siempre a pantalla completa, sin botón. Al cerrar hace `router.back()` y devuelve el foco al elemento que lo abrió. Si el formulario tiene cambios, pide confirmación dentro de la ventana | No guarda datos | RF-4, RF-5, RF-6, RF-7, RF-12, RF-29 |
| `event-panel` | `src/components/calendar/event-panel.tsx` | Detalle con los botones "Editar", "Duplicar" y "Borrar"; "Editar" cambia a `EventForm` en el mismo sitio. Lo usan la ventana y la página completa | No decide permisos (llegan de la carga, con RLS) | RF-2, RF-3, RF-35, RF-36 |
| `modal-actions` | `src/app/dashboard/events/actions.ts` (existente) | `createEvent`, `updateEvent` y `deleteEvent` aceptan el campo oculto `mode=modal`: en ese modo devuelven `{ done: "created" \| "updated" \| "deleted" }` en vez de `redirect()`; con error, el estado de siempre con los valores escritos. `revalidatePath` igual que hoy | Sin validaciones nuevas | RF-8, RF-9, RF-11, RF-38 |
| `toast` | `src/components/ui/toast.tsx` (contexto + región `role="status"` `aria-live="polite"`) | `useToast().show(texto)`: aviso abajo, desaparece a los 4 s, se anuncia. Mensajes: "Evento creado", "Cambios guardados", "Evento borrado" | Sin "Deshacer" (fuera de alcance) | RF-32 |
| `time-options` | `src/lib/calendar/time-options.ts` | Puro: `startOptions()` (00:00–23:30 cada 30 min), `endOptions(start)` (desde el inicio, cada 30 min, con duración "30 min", "1 h", "1 h 30 min"), `normalizeTime("9:5")` → `"09:05"` o `null`, `shiftEnd(oldStart, newStart, end)` (conserva la duración) y `clampEnd` (23:59) | Sin DOM | RF-13, RF-16, RF-17, RF-30, RF-49 |
| `time-field` | `src/components/ui/time-field.tsx` | Combobox accesible (patrón ARIA *combobox* + *listbox*): campo de texto editable, lista al recibir el foco, flechas, Intro elige, Escape cierra sin cambiar. Envía `HH:MM` con el mismo `name` que hoy | No valida (lo hace el servidor como hoy) | RF-13, RF-14, RF-15, RF-16, RF-49 |
| `event-form` | `src/components/calendar/event-form.tsx` (existente) | Usa `TimeField`; recuerda si el usuario tocó la hora de fin para mover o no el fin (RF-17/18); foco en Título al abrir el alta; campo oculto `mode`; avisa al `EventModal` de que hay cambios (evento `input`) | — | RF-17, RF-18, RF-28, RF-30, RF-7 |
| `slots` | `src/lib/calendar/slots.ts` | Puro: `minuteAt(y, columnHeight, step)` (redondeo a 30 min en clic y a 15 en arrastre), `dragRange(fromMin, toMin)` (ordena, mínimo 15 min, recorta a 0–1440), `clickRange(minute)` (media hora pulsada + 1 h con `clampEnd`) y `toDraft(day, range)` | Sin DOM | RF-20, RF-30, RF-42, RF-43 |
| `slot-layer` | `src/components/calendar/slot-layer.tsx` | Capa de cada columna de `TimeGrid` bajo los eventos: `pointerdown/move/up` con *pointer capture*; si `pointerType === "touch"` no arrastra y un toque actúa como clic; Escape cancela. Por cada día, un botón accesible "Crear evento el <día>" (visible al recibir el foco) que abre la ventana rápida a las 09:00 | No pinta eventos | RF-20, RF-22, RF-42, RF-43, RF-44, RF-45 |
| `month-cell` | `src/components/calendar/month-view.tsx` (existente) | El fondo vacío de cada celda es un botón "Crear evento el <día>" que crea un borrador de día completo; el número sigue llevando a la vista día | — | RF-19, RF-21, RF-22 |
| `month-chips` | `src/components/calendar/event-chip.tsx` (existente) | Variante `dot` (punto del color + hora en negrita + título, sin relleno) para eventos con hora y variante `bar` (relleno del color pastel, texto en tinta, contorno `ink/15`) para día completo y varios días | — | RF-48 |
| `quick-create` | `src/components/calendar/quick-create.tsx`, `src/lib/calendar/popover.ts` | Ventana rápida (`<dialog>` modal con fondo muy suave): título (foco), día y horas (`TimeField`, o "Añadir hora" si es de día completo), calendario con su punto de color, "Más opciones" y "Guardar". Posición junto al hueco con `placePopover(anchor, tamaño, viewport)` (puro, nunca se sale de la pantalla); a ≤ 768 px, hoja inferior a todo el ancho. "Guardar" llama a `createEvent` en modo modal; "Más opciones" navega a `/dashboard/events/new?date&start&end&allDay&calendar&title` | No muestra descripción, lugar ni categoría | RF-19, RF-20, RF-37, RF-38, RF-39, RF-41 |
| `draft-block` | `src/components/calendar/time-grid.tsx` y `month-view.tsx` (existentes) | Pintan el borrador como bloque con borde discontinuo y el título escrito o "(Sin título)", y lo actualizan mientras se arrastra | — | RF-40, RF-42 |
| `workspace` | `src/components/calendar/calendar-workspace.tsx` (existente) | Guarda el borrador, abre y cierra `QuickCreate`, pasa a las vistas `onCreateDraft` solo si `canCreate`, recibe los calendarios editables (orden del panel, primero visible por defecto) | — | RF-36, RF-37, RF-40 |
| `shortcuts` | `src/lib/calendar/shortcuts.ts`, `src/lib/hooks/use-calendar-shortcuts.ts` | Puro: `shortcutFor(event)` ignora teclas con modificadores, con el foco en `input`/`textarea`/`select`/`[contenteditable]` o con un `dialog[open]`; mapea N, T, ←, →, A, M, S, D. El hook navega con `router.push` (N abre el alta interceptada) y guarda la vista (A/M/S/D) | — | RF-31, RF-36, RF-46 |
| `view-toolbar` | `src/components/calendar/view-toolbar.tsx` (existente) | Cada botón de vista muestra su tecla (`<kbd>`, `aria-keyshortcuts`) y al pulsarlo llama a `saveLastView` sin esperar | — | RF-25, RF-46 |
| `last-view` | `supabase/migrations/2026102330…_profile_last_view.sql`, `src/app/dashboard/calendar/preferences-actions.ts` (`saveLastView`), `src/lib/calendar/queries.ts` (`getLastView`), `src/lib/calendar/ranges.ts` (`parseViewParams` acepta la vista guardada) | Guarda la última vista en el perfil; sin `?view` se usa la guardada con la fecha de hoy, o agenda; con `?view` manda la URL | No guarda la fecha | RF-25, RF-26, RF-27 |
| `agenda-now` | `src/components/calendar/agenda-view.tsx` (existente) | Botón "Hora actual" siempre visible: si hoy está en la agenda, desplaza a la línea de la hora actual (`scrollIntoView`); si no, navega a la agenda de hoy con `#ahora` | — | RF-23, RF-24 |
| `time-grid-height` | `src/components/calendar/time-grid.tsx` (existente) | La zona con desplazamiento pasa de `max-h-[28rem]` a una altura `calc(100dvh - …)` con mínimo de 28 rem | — | RF-47 |
| `calendar-skeleton` | `src/components/calendar/calendar-skeleton.tsx`, `src/app/dashboard/calendar/page.tsx` | Un componente lee solo `searchParams` y envuelve el contenido en `<Suspense>` con un esqueleto de la forma de la vista (filas de agenda, rejilla de mes o columnas de horas) | — | RF-33 |
| `refresh-on-focus` | `src/lib/hooks/use-refresh-on-focus.ts` | Al volver a primer plano (`visibilitychange`), `router.refresh()` si han pasado más de 60 s desde `loadedAt` | — | RF-34 |
| `duplicate` | `event-loaders` + `event-panel` | "Duplicar" navega a `/dashboard/events/new?from=<id>`; el cargador lee el evento con RLS y rellena el alta con título, descripción, lugar, color, categoría, hora y duración | No guarda nada hasta confirmar | RF-35, RF-36 |

## Modelo de datos

- `profiles.last_view text null`, `check (last_view in ('agenda','month','week','day'))`. Nulo = nunca elegida (RF-26 cae en agenda).
  - Sin políticas nuevas: "leer y actualizar solo el propio" de `profiles` ya la cubre (P3). `visible_people()` y `calendar_members_with_names` no la exponen.
  - Tras la migración: `npm run db:types` y test de integración (`tests/integration/profile-last-view.test.ts`): el usuario guarda y lee la suya, no ve ni cambia la de otro, y un valor fuera de la lista da `23514`.
- El resto no cambia: eventos, permisos y validaciones de las specs 002 y 006 (NF-5).
- Borrador del cliente (no se guarda): `{ day: "YYYY-MM-DD", allDay: boolean, startMinute: number, endMinute: number, title: string, calendarId: string }`.

## Contratos e interfaces

- **Rutas:** `/dashboard/events/new` acepta además `start=HH:MM`, `end=HH:MM`, `allDay=1`, `title=<texto ≤ 100>` y `from=<uuid>`. Los valores no válidos se ignoran (como hoy `date` y `calendar`). Navegación interna → ventana; recarga o enlace → página completa.
- **Server Actions:**
  - `createEvent(prev, formData)` y `updateEvent(id, prev, formData)`: con `mode=modal` → `{ done: "created" | "updated" }` o el estado de error; sin `mode`, `redirect` como hoy.
  - `deleteEvent(id, mode?)` → con `"modal"` devuelve `{ done: "deleted" }`.
  - `saveLastView(view: CalendarView) → { error?: string }` (valida con `zod`, `update` de la fila propia, sin `revalidatePath`: no cambia lo que se ve).
- **`/dashboard/calendar`:** sin `view` → `profiles.last_view ?? "agenda"` con la fecha de hoy; `view` válida → esa (RF-27); `view` no válida → agenda desde hoy, como hoy.
- **Atajos (sin modificadores, fuera de campos y sin ventanas abiertas):** N alta, T hoy, ← y → periodo anterior y siguiente, A agenda, M mes, S semana, D día. N no existe para un usuario solo Lector.

## Flujo principal paso a paso

1. **Alta rápida.** El usuario pulsa una franja del jueves a las 10:12 en la semana → `SlotLayer` calcula 10:00–11:00 (`clickRange`, RF-20) → el workspace guarda el borrador → `TimeGrid` pinta "(Sin título)" (RF-40) y se abre `QuickCreate` junto al hueco con el foco en el título (RF-37).
2. Escribe "Cena" (el bloque provisional muestra "Cena") y pulsa "Guardar" → `createEvent` en modo modal (misma validación y RLS, RF-11, RF-38) → `{ done: "created" }` → se cierra, `router.refresh()` y aviso "Evento creado" (RF-32).
3. **Arrastre.** Con el ratón arrastra de 16:00 a 17:30 → bloque provisional en pasos de 15 min (RF-42) → al soltar, `QuickCreate` con 16:00–17:30. Escape a medias cancela (RF-44). En el móvil un toque actúa como clic (RF-45).
4. **Más opciones.** Desde `QuickCreate` → `router.push("/dashboard/events/new?date=…&start=16:00&end=17:30&calendar=…&title=Cena")` → el slot `@modal` intercepta y abre `EventModal` con el formulario completo relleno (RF-39), con pantalla completa opcional (RF-5) o forzada a ≤ 768 px (RF-29).
5. En el formulario cambia la hora de inicio con `TimeField` → la de fin se mueve conservando la duración (RF-17) y la lista de fin muestra duraciones (RF-49). Guarda → se cierra la ventana (`router.back()`) en la misma vista y fecha (RF-8). Si hay error, la ventana sigue abierta con lo escrito (RF-9).
6. **Detalle.** Pulsa el evento → `/dashboard/events/<id>` interceptada → `EventPanel` en la ventana (RF-2) → "Editar" (RF-3) o "Duplicar" (RF-35). Cerrar con cambios → confirmación (RF-7).
7. **Vistas.** Pulsa M o el botón "Mes" → navega y guarda `last_view` (RF-25, RF-46). Al abrir la app sin `?view` vuelve el mes de hoy (RF-26). El mes muestra punto o barra (RF-48); la semana ocupa el alto de la pantalla (RF-47).

## Decisiones técnicas

- D1: Ventana con **rutas interceptadas + slot paralelo `@modal`** en `/dashboard`. Descartado un `<dialog>` cargado solo en el cliente porque obliga a duplicar la carga de datos y no da URL ni "Atrás". Motivo: patrón documentado de Next 16 (`intercepting-routes.md`) que cumple RF-10 sin código extra. Decisión del usuario. Cubre: RF-1, RF-2, RF-10.
- D2: Las acciones existentes reciben un **campo oculto `mode=modal`** y devuelven estado en lugar de redirigir. Descartado duplicar acciones (`createEventFromModal`…) por repetir validación y traducción de errores. Motivo: una sola ruta de escritura (RF-11). Cubre: RF-8, RF-9, RF-38.
- D3: **La ventana rápida no es una ruta**, es estado del workspace. Descartado interceptar también un `/events/quick` porque no tiene página completa equivalente y debe colocarse junto al hueco. Motivo: es efímera y depende de la posición en pantalla. Cubre: RF-37, RF-40, RF-41.
- D4: **"Más opciones" pasa los datos por la URL** (`start`, `end`, `title`…). Descartado guardarlos en `sessionStorage` porque una recarga los perdería y no se pueden testear en el servidor. Motivo: la página completa y la ventana leen lo mismo. Cubre: RF-39.
- D5: **`TimeField` propio** con el patrón ARIA combobox sobre un campo de texto. Descartado `<input type="time">` con `<datalist>`, que no se puede estilar ni se comporta igual en Safari iOS. Descartadas librerías (P6). Cubre: RF-13 a RF-16, RF-49.
- D6: **Arrastre con Pointer Events** y `setPointerCapture`; sin arrastre si `pointerType === "touch"`. Descartado el arrastre táctil con pulsación larga, que choca con el desplazamiento de la rejilla. Motivo: lo pide RF-45 y no necesita dependencias. Cubre: RF-42 a RF-45.
- D7: **Vista recordada en `profiles.last_view`** escrita con una Server Action al elegir la vista. Descartado guardarla al pintar la página (efecto en un GET) y descartado `localStorage` (RF-25 pide la misma en todos los dispositivos). Cubre: RF-25 a RF-27.
- D8: **Avisos con un contexto propio** en `AppFrame` y región `aria-live`. Descartado pasar el aviso por la URL (`?saved=1`), que ensucia el historial y reaparece al recargar. Cubre: RF-32.
- D9: **Enmienda de P9 (aprobada por el usuario el 2026-10-23):** en la vista mes, las barras de día completo y de varios días pueden ir **rellenas con el color pastel del calendario**, con texto en tinta y contorno `ink/15`. Fuera de esa barra el color sigue siendo solo marca. Descartado respetar P9 sin cambios porque RF-48 pide distinguir los dos tipos como en Google. Se registra en la constitución al cerrar. La guardia `design-tokens` sigue igual (el color va en `style`). Cubre: RF-48.
- D10: **Accesibilidad de los huecos:** un botón por día ("Crear evento el lunes 19") en semana y día, y el fondo de cada celda en mes. Descartado un botón por cada media hora (336 paradas de tabulador en la semana). Motivo: RF-22 con una navegación por teclado razonable. Cubre: RF-22.
- D11: **Altura de la rejilla con `calc(100dvh - …)`** y mínimo de 28 rem. Descartado medir con JavaScript (salto al hidratar). Cubre: RF-47.

## Trazabilidad RF → módulo

| RF | Módulos |
|----|---------|
| RF-1 | modal-routes, event-modal |
| RF-2 | modal-routes, event-panel |
| RF-3 | event-panel |
| RF-4 | event-modal |
| RF-5 | event-modal |
| RF-6 | event-modal |
| RF-7 | event-modal, event-form |
| RF-8 | modal-actions, event-modal, toast |
| RF-9 | modal-actions |
| RF-10 | modal-routes, event-loaders |
| RF-11 | modal-actions, event-loaders |
| RF-12 | event-modal |
| RF-13 | time-options, time-field |
| RF-14 | time-field |
| RF-15 | time-field |
| RF-16 | time-options, time-field |
| RF-17 | time-options, event-form |
| RF-18 | event-form |
| RF-19 | month-cell, quick-create |
| RF-20 | slots, slot-layer, quick-create |
| RF-21 | month-cell (sin cambios en el número del día) |
| RF-22 | slot-layer, month-cell |
| RF-23 | agenda-now |
| RF-24 | agenda-now |
| RF-25 | last-view, view-toolbar, shortcuts |
| RF-26 | last-view |
| RF-27 | last-view |
| RF-28 | event-form, quick-create |
| RF-29 | event-modal |
| RF-30 | time-options, slots |
| RF-31 | shortcuts |
| RF-32 | toast |
| RF-33 | calendar-skeleton |
| RF-34 | refresh-on-focus |
| RF-35 | duplicate, event-loaders, event-panel |
| RF-36 | event-panel, shortcuts, workspace |
| RF-37 | quick-create, workspace |
| RF-38 | quick-create, modal-actions |
| RF-39 | quick-create, event-loaders |
| RF-40 | draft-block, workspace |
| RF-41 | quick-create |
| RF-42 | slots, slot-layer, draft-block |
| RF-43 | slots |
| RF-44 | slot-layer |
| RF-45 | slot-layer |
| RF-46 | shortcuts, view-toolbar |
| RF-47 | time-grid-height |
| RF-48 | month-chips |
| RF-49 | time-options, time-field |

## Riesgos y mitigaciones

- R1: **Rutas interceptadas con `cacheComponents`** (Next conserva la página anterior oculta con Activity): la ventana podría quedarse montada o el foco no volver. Mitigación: la primera tarea monta solo el esqueleto `@modal` y se prueba en el navegador (abrir, cerrar, Atrás, recargar) antes de mover formularios.
- R2: **Datos viejos tras cerrar con `router.back()`**: la caché del router podría enseñar el calendario sin el evento nuevo. Mitigación: `revalidatePath` ya existe y además `router.refresh()` tras cerrar; test manual en el navegador.
- R3: **Conflicto entre arrastre y desplazamiento** en pantallas táctiles. Mitigación: sin arrastre táctil (D6) y `touch-action` sin cambios en la rejilla.
- R4: **Atajos que se disparan escribiendo**: mitigación en `shortcutFor` (función pura con tests de cada caso: campos, modificadores, ventana abierta).
- R5: **Contraste del relleno pastel** (D9): test que comprueba ≥ 4,5:1 entre `ink` y cada color de la paleta.
- R6: **`test:db` intermitente** (trampa conocida): repetir antes de investigar.
- R7: **Escenarios que REA no pudo observar** (arrastre de Google): se implementa según la spec, no según una observación; se valida en el navegador con el usuario.

## Verificación (P8)

Cada tarea: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`; la de la migración, también `npm run test:db`. Las de interfaz, capturas a 390, 768 y 1440 px con los acentos rojo y amarillo y recorrido en el navegador con `playwright-cli` (crear con la ventana rápida, arrastrando y con el formulario completo; editar, duplicar y borrar en la ventana; atajos; recargar una URL de evento).

## Dudas abiertas

Ninguna.
