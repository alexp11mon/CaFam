# Plan 016 — Calendario al estilo Google Calendar en el móvil

Spec de origen: `specs/016-calendario-estilo-google/spec.md` (aprobada el 2026-10-30). Plan aprobado el 2026-10-30. Constitución: `docs/constitution.md`, con la enmienda 4 (bloques rellenos, composición del móvil, día de la agenda y banda del mes). No hay migraciones, dependencias nuevas ni pasos fuera del repositorio.

## Resumen de arquitectura

Es un cambio solo de interfaz, sobre las piezas que ya existen.

- **Marco.** `AppFrame` gana una **cabecera superior del móvil** (`TopBar`) con su **cajón** (`NavDrawer`, un `<dialog>` nativo), y la barra inferior deja de verse en el móvil. Una variante de Tailwind propia, `phone` (≤ 768 px), y su contraria, `tab` (≥ 769 px), separan las dos composiciones (D1).
- **Calendario.** `CalendarWorkspace` le pasa a la cabecera lo que depende de la vista a través de un contexto pequeño (`CalendarHeaderContext`): el título, la acción de "Hoy" y el selector desplegable. Los filtros entran en el cajón con un portal (D3).
- **Vistas.** Pintan **bloques rellenos** con un único componente (`EventBlock`). Hay tres diseños puros nuevos y testeados: carriles del mes (`month-lanes`), feed continuo de la agenda (`agenda-feed`) y gesto de deslizar (`swipe`).
- **Agenda continua.** Carga más días con una Server Action (`loadAgendaEvents`), del mismo modo que el mini calendario carga sus puntos.

```
AppFrame (data-accent)
├─ SideRail (≥ 1024 px, sin cambios)
├─ BottomBar (769–1023 px, como hoy; oculta en phone)
├─ TopBar (solo phone) ── lee CalendarHeaderContext ──┐
│   ├─ ≡ → NavDrawer <dialog> (vistas · [portal de filtros] · destinos · tema · salir)
│   ├─ título (nav o mes del calendario) + flecha → selector (MonthStrip | MiniMonth)
│   ├─ "Hoy" (icono con el número)   └─ Avatar → /dashboard/settings
└─ página
    └─ /dashboard/calendar → CalendarWorkspace ── publica {título, hoy, selector} en el contexto
         ├─ ViewToolbar, NextEventCard, panel (solo tab)
         ├─ useSwipe (mes, semana, día; táctil) → router.push con CAL_PREV / CAL_NEXT
         ├─ MonthView ── layoutMonthWeek() → filas con carriles y "+N"
         ├─ WeekView / DayView ── TimeGrid (cabecera fija, franja, bloques, línea de ahora)
         ├─ AgendaView ── buildAgendaFeed() + loadAgendaEvents() (scroll infinito en los dos sentidos)
         └─ Fab "+" (solo phone, si canCreate)
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `breakpoints` | `src/app/globals.css` | Define `--breakpoint-tab: 48.0625rem` (769 px). Así `tab:` es ≥ 769 px y `max-tab:` ≤ 768 px | No cambia `lg` (barra lateral desde 1024 px) | RF-6, RF-7, RF-19, RF-61 |
| `use-is-phone` | `src/lib/hooks/use-is-phone.ts` | `useIsPhone()`: `matchMedia("(width <= 768px)")` con `useSyncExternalStore` (snapshot de servidor `false`), para lo que el CSS no resuelve (portal de filtros, gestos) | No decide estilos | RF-13, RF-25 |
| `event-block` | `src/components/calendar/event-block.tsx` | Bloque relleno (`style.backgroundColor = event.color`, texto `text-pastel-ink`, título en negrita, `ImageMark`, contorno `ring-pastel-ink/15`) en tres formas: `line` (mes y franja de día completo: una línea, sin hora), `grid` (semana y día: título y lugar en varias líneas, recorte por altura) y `card` (agenda: título y "A las … en …"). Enlaza al detalle | No calcula posiciones | RF-1, RF-2, RF-4, RF-5, RF-34, RF-41, RF-42, RF-54, RF-55, RF-56 |
| `event-chip` (retirada) | `src/components/calendar/event-chip.tsx`, `event-row.tsx` | Se borran: `EventBlock` los sustituye. `ImageMark` pasa a `event-block.tsx` | — | RF-1 |
| `palette-contrast` | `tests/unit/palette.test.ts`, `src/lib/theme/accents.ts` (si hace falta) | Comprueba ≥ 4,5:1 entre `pastel-ink` y cada color pastel **en los dos temas** | — | RF-3 |
| `header-context` | `src/components/shell/calendar-header.tsx` | `CalendarHeaderProvider` (en `AppFrame`) y `useCalendarHeader()`. Guarda `{ title, onToday, picker: "months" \| "mini" \| null, pickerOpen }` y la ranura del cajón para los filtros (`drawerSlot`) | No sabe nada de las vistas | RF-8, RF-10, RF-13, RF-20, RF-23, RF-59 |
| `top-bar` | `src/components/shell/top-bar.tsx` | Cabecera `max-tab:flex` fija arriba, con cristal (`glass`) y `env(safe-area-inset-top)`. Lleva ≡, título (el del contexto, o la etiqueta de `activeSection`), botón "Hoy" (`TodayIcon` con el número del día, solo en el calendario) y `Avatar` (enlace a Ajustes). El título del calendario es un botón con flecha, `aria-expanded`, que abre o cierra el selector | No pinta el selector | RF-6, RF-8, RF-9, RF-10, RF-11, RF-12, RF-20, RF-23 |
| `nav-drawer` | `src/components/shell/nav-drawer.tsx` | `<dialog>` modal desde la izquierda (`glass-float`, entrada con `@starting-style`). Con él vienen gratis el foco atrapado y Escape; al cerrar devuelve el foco a ≡. Contenido: vistas (solo en el calendario, enlaces con `saveLastView` y la actual marcada), ranura de filtros, destinos de `NAV_ITEMS` (salvo Calendario), `ThemeToggle` y Cerrar sesión. Se cierra al pulsar el fondo, al elegir un enlace o al deslizar a la izquierda (`useSwipe`) | No tiene estado de filtros | RF-12, RF-13, RF-14, RF-15, RF-16 |
| `app-frame` | `src/components/shell/app-frame.tsx`, `bottom-bar.tsx`, `src/app/dashboard/layout.tsx`, `src/lib/calendar/queries.ts` (`getAppearance`) | Monta `CalendarHeaderProvider`, `TopBar` y `NavDrawer`. La `BottomBar` pasa a `hidden tab:block lg:hidden`. El relleno del contenido es `max-tab:pt-[cabecera]` en lugar de `pb-24`. `getAppearance` devuelve también `display_name` para el avatar | — | RF-6, RF-7, RF-11, RF-61 |
| `fab` | `src/components/calendar/fab.tsx` | Botón flotante "+" (`max-tab:flex`, fijo abajo a la derecha con margen de `safe-area`, círculo `bg-ink text-on-ink shadow-float`). Enlaza a `/dashboard/events/new?date=` y solo existe con `canCreate` | — | RF-17, RF-18 |
| `month-strip` | `src/components/calendar/month-strip.tsx`, `src/lib/calendar/month-strip.ts` | Fila desplazable de meses. Lógica pura `monthStrip(visibleMonth)`: de 12 meses antes a 24 después, con un elemento "año" entre diciembre y enero. Al abrir, centra el mes visible (`aria-current`). Pulsar un mes navega a `view=month&date=YYYY-MM-01` | — | RF-20, RF-21, RF-22 |
| `title-picker` | `src/components/calendar/calendar-workspace.tsx` (bajo la cabecera, `max-tab:` solo) | Según la vista, pinta `MonthStrip` o `MiniMonth` (el actual, con sus puntos) cuando `pickerOpen`. Al elegir un día, cierra el selector | — | RF-20, RF-23, RF-24 |
| `swipe` | `src/lib/calendar/swipe.ts`, `src/lib/hooks/use-swipe.ts` | Función pura `swipeDirection(dx, dy)` → `"next" \| "previous" \| null` (≥ 50 px y \|dx\| > \|dy\|). El hook escucha `pointerdown/up` solo con `pointerType === "touch"` y no actúa si hay un `dialog[open]`, un borrador abierto o un `disabled` | No navega | RF-25, RF-26, RF-27, RF-28 |
| `workspace` | `src/components/calendar/calendar-workspace.tsx`, `src/app/dashboard/calendar/page.tsx` | Publica en el contexto el título (mes de `date` o el de la agenda), "Hoy" y el selector. En `phone`, monta los filtros en `drawerSlot` con `createPortal`, solo mientras la ruta es el calendario. Oculta en `phone` `ViewToolbar`, "Nuevo evento", `NextEventCard`, el botón "Calendarios y filtros" y el panel lateral. Aplica `useSwipe` a mes, semana y día, y navega con `CAL_PREV`/`CAL_NEXT` (transición de la 011). Pinta el `Fab` | — | RF-10, RF-13, RF-17, RF-19, RF-25, RF-26, RF-28, RF-29, RF-62 |
| `month-lanes` | `src/lib/calendar/month-lanes.ts` | Diseño puro por semana: `layoutMonthWeek(events, weekDays, tz)` → `{ event, start, span, lane }[]`. Reparte en carriles de forma voraz y ordena primero los de varios días, luego por inicio y por duración. `fitWeek(items, maxLanes)` → los visibles y `hidden[día]`: si un día no cabe, usa `maxLanes - 1` carriles y la última línea es "+N" | No mide el DOM | RF-34, RF-35, RF-36 |
| `month-view` | `src/components/calendar/month-view.tsx` | Rejilla a toda la altura (`h-[calc(100dvh-…)]`, filas `flex-1`) con las iniciales arriba (la de hoy en `accent-ink`) y una fila por semana con `display: grid` de 7 columnas. Cada bloque `line` va con `grid-column: start / span`. Un `ResizeObserver` mide la altura de la fila y calcula `maxLanes`. "+N" enlaza a la vista día. Número de hoy en círculo `bg-accent`; días de otro mes en `text-muted`. Conserva el botón de crear de cada día (spec 008) | — | RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, RF-36, RF-37, RF-46 |
| `time-grid` | `src/components/calendar/time-grid.tsx`, `day-view.tsx`, `week-view.tsx`, `scroll-on-mount.tsx` | Cabecera fija (`sticky`) con la inicial y el número grande (`text-2xl`; el de hoy en círculo `bg-accent` y la inicial en `accent-ink`). Franja de día completo con bloques `line`. Bloques `grid` (título en negrita y lugar). Horas "9:00". Línea de ahora (`useNow`) con un punto en el borde izquierdo, en `accent-ink`. Al abrir con hoy visible, desplaza a la hora actual menos 1 h; si no, a las 7:00. En `phone` quita el `minWidth: 40rem` para que las 7 columnas quepan. `SlotLayer` y el borrador no cambian | — | RF-38, RF-39, RF-40, RF-41, RF-42, RF-43, RF-44, RF-45, RF-46 |
| `agenda-feed` | `src/lib/calendar/agenda-feed.ts` (sustituye a `agenda.ts`) | Diseño puro `buildAgendaFeed({ days, events, tz, today })` → lista de `month` (banda), `week` ("2–8 de noviembre", más `empty: true` si no tiene eventos) y `day` (abreviatura, número, `isToday` y las entradas con "A las 11:15–14:15 en <lugar>", "11:15–14:15" o solo el título si es de día completo). También `anchorDay(feed, today)`: hoy o el primer día posterior con eventos | No hace scroll | RF-47, RF-50, RF-51, RF-52, RF-53, RF-54, RF-55, RF-57, RF-58 |
| `agenda-loader` | `src/app/dashboard/calendar/agenda-actions.ts`, `src/lib/calendar/to-view-events.ts` | Server Action `loadAgendaEvents(from, to)`: valida dos fechas `YYYY-MM-DD` y como mucho 62 días, lee con RLS (`getEventsInRange`) y devuelve `AgendaEvent[]` con color y nombre de calendario. `toViewEvents(records, calendars)` se saca de `page.tsx` para usarlo en los dos sitios | No filtra por visibilidad (eso lo hace el workspace, como hoy) | RF-48, RF-49 |
| `agenda-view` | `src/components/calendar/agenda-view.tsx` | Lista continua: estado `{ firstDay, lastDay, events }`, centinelas con `IntersectionObserver` arriba y abajo que piden tramos de 28 días. Al añadir arriba, corrige el `scrollY` con la diferencia de altura (`useLayoutEffect`). Con más de 120 días, suelta tramos del extremo contrario. Bandas de mes (`bg-agenda-band`, degradado de tokens), separadores de semana, columna de día (abreviatura, número y círculo de hoy) y bloques `card`. Observa qué mes está arriba para el título (`onMonthChange`) y expone `scrollToAnchor()` para "Hoy". Aplica el filtro de visibilidad que recibe | — | RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53, RF-57, RF-58, RF-59, RF-60 |
| `view-toolbar` | `src/components/calendar/view-toolbar.tsx` | En la agenda quita anterior y siguiente; "Hoy" llama a `scrollToAnchor` si la agenda ya está en pantalla. El resto, igual | — | RF-47, RF-61 |
| `skeleton` | `src/components/calendar/calendar-skeleton.tsx` | Esqueletos con la forma nueva (mes a toda la altura, agenda con banda) | — | RF-30, RF-50 |
| `design-guard` | `tests/unit/design-tokens.test.ts`, `src/app/globals.css` | Añade `nav-drawer.tsx` y `fab.tsx` a `FLOATING`. Añade el token `--gradient-agenda-band` (claro y oscuro) y su utilidad `bg-agenda-band`. Mantiene la prohibición de colores sueltos (el color del evento sigue yendo en `style`) | — | RF-50, RF-63 |
| `validation` | capturas en `specs/016-…/evidencias/`, `tasks.md` | Capturas a 390, 768 y 1440 px de las cuatro vistas y del cajón, en claro y oscuro, con acento rojo y amarillo, junto a las de Google. Prueba táctil (emulación de iPhone en `playwright-cli` y un iPhone real) | — | todos |

## Modelo de datos

No hay cambios en la base de datos. En el cliente:

- `CalendarEventItem` (de `layout.ts`) gana `location?: string | null`. La necesitan los bloques de semana y día (RF-41); hoy solo la lleva `AgendaEvent`. `AgendaEvent` se queda como alias con `calendarName`.
- `MonthLaneItem<T> { event: T; start: 0..6; span: 1..7; lane: number }`.
- `AgendaFeedItem = { kind: "month"; key: "YYYY-MM"; label } | { kind: "week"; key; label; empty: boolean } | { kind: "day"; key; weekday; number; isToday; entries: { event; line: string | null }[] }`.
- `CalendarHeaderState { title: string | null; onToday: (() => void) | null; picker: "months" | "mini" | null; pickerOpen: boolean }`.
- Altura del carril del mes: 18 px de bloque + 2 px de separación. La cabecera del día mide 24 px. Son constantes en `month-lanes.ts`.

## Contratos e interfaces

- **Server Action** `loadAgendaEvents(from: string, to: string): Promise<{ events: AgendaEvent[] } | { error: string }>`.
  - Con fechas no válidas, `to < from` o más de 62 días, devuelve `{ error: CALENDAR_MESSAGES.notFound }`.
  - Si falla la red o la base de datos, devuelve `{ error: CALENDAR_MESSAGES.connection }`.
  - Lee con la sesión del usuario: RLS decide qué eventos ve (P3).
- **Funciones puras**, con su test:
  - `swipeDirection(dx, dy)`.
  - `monthStrip(month)`.
  - `layoutMonthWeek(events, days, tz)` y `fitWeek(items, maxLanes)`.
  - `buildAgendaFeed(...)`, `anchorDay(feed, today)` y `weekLabel(first, last)` ("2–8 de noviembre", "28 de octubre – 3 de noviembre").
- **Contexto** `useCalendarHeader()` devuelve `{ state, setState, drawerSlot }`. El workspace lo publica en un efecto y lo limpia al desmontar o al ocultarse por Activity, en la función de limpieza (trampa conocida).
- **URL:** `?view=&date=` sin cambios. En la agenda, `date` es el día ancla al abrir.

## Flujo principal paso a paso

1. **Apertura en el móvil.**
   - `AppFrame` pinta la `TopBar` y oculta la `BottomBar` (RF-6, RF-7).
   - El workspace publica el título "noviembre", "Hoy" y el selector (RF-8, RF-9).
   - Se ocultan la barra de herramientas y "Próximo evento" (RF-19).
2. **≡.** Abre `NavDrawer` con `showModal()`, que atrapa el foco. Dentro están las vistas, los filtros (llevados con el portal), los destinos, el tema y Cerrar sesión (RF-12, RF-13, RF-16). Elegir algo navega y cierra el cajón; también se cierra con Escape, con el fondo o deslizando (RF-14, RF-15).
3. **Título.**
   - En la vista mes despliega `MonthStrip`; pulsar "dic" navega (RF-20, RF-21, RF-22).
   - En las demás vistas despliega `MiniMonth`; pulsar un día navega y pliega el selector (RF-23, RF-24).
4. **Deslizar en mes, semana o día.**
   1. `pointerdown`/`pointerup` táctil, y `swipeDirection` decide.
   2. Si no hay ningún `dialog` ni borrador abierto (RF-28), `router.push(navigate(view, date, ±1))` con `CAL_NEXT`/`CAL_PREV` (RF-25, RF-26, RF-27, RF-29).
5. **Vista mes.**
   1. Cada semana pasa por `layoutMonthWeek` y luego por `fitWeek(maxLanes)` según la altura medida.
   2. Se pintan bloques `line` con su `span` y "+N", que enlaza a la vista día (RF-30–RF-37).
6. **Semana y día.**
   - La cabecera es fija, la franja lleva los eventos de día completo y los bloques `grid`.
   - La línea de ahora tiene su punto, y la vista se desplaza a la hora actual (RF-38–RF-45).
   - Crear desde un hueco funciona igual que hoy (RF-46).
7. **Agenda.**
   1. El servidor manda 14 días antes y 42 después de `date`.
   2. `buildAgendaFeed` construye la lista y `scrollToAnchor()` lleva a hoy o al siguiente día con eventos (RF-58).
   3. Al bajar, el centinela inferior pide `loadAgendaEvents(lastDay+1, lastDay+28)` (RF-48).
   4. Al subir, el superior pide el tramo anterior y se corrige el scroll (RF-49).
   5. El título de la cabecera sigue al mes que está arriba (RF-59).
8. **"+".** Abre el alta en la ventana sobre el calendario, como hoy "+ Evento" (RF-17).

## Decisiones técnicas

- **D1:** variante `tab` (≥ 769 px) y `max-tab` (≤ 768 px) con `--breakpoint-tab`. Descartado `md`/`max-md` de Tailwind (`< 768 px`), porque dejaría el iPad mini vertical (768 px) en la composición de escritorio, en contra de "768 px o menos". Cubre: RF-6, RF-7, RF-19, RF-61.
- **D2:** la cabecera y el cajón viven en `AppFrame`, de modo que todas las pantallas del panel los tienen. Descartado un `TopBar` en cada página, porque obligaría a repetirlo en 15 rutas y la spec lo pide en todas. Cubre: RF-6, casos límite (otras pantallas).
- **D3:** los filtros entran en el cajón con `createPortal` desde el workspace, que es quien tiene su estado. Descartados dos alternativas:
  - subir el estado de los filtros al marco, porque obliga a reescribir la lógica optimista de la 002 y la 007;
  - duplicar el panel, porque habría dos fuentes de estado.
  
  Cubre: RF-13, RF-62.
- **D4:** cajón con `<dialog>` nativo, como la hoja "Más". Descartado un `div` con `aria-modal`, porque habría que programar a mano el foco atrapado y Escape. Cubre: RF-15, RF-16.
- **D5:** el gesto de deslizar se hace con Pointer Events, solo `pointerType === "touch"`, y `touch-action: pan-y` en las vistas. Descartado Touch Events, porque duplica el código del ratón y no deja distinguir el lápiz. Descartada una librería de gestos por P6. Cubre: RF-25–RF-28.
- **D6:** el mes se diseña por semana en **carriles** (de forma voraz) dentro de un grid de 7 columnas, con `span` para los eventos de varios días. Descartado seguir pintando cada día por separado (como hoy), porque no puede dibujar un bloque continuo (RF-35). Cubre: RF-34, RF-35, RF-36.
- **D7:** cuántos carriles caben en el mes se mide con `ResizeObserver` (filas a toda la altura de la pantalla). Descartado un máximo fijo de 3, como hoy, porque Google llena la celda según el alto del móvil (RF-36: "los que quepan"). Cubre: RF-30, RF-36.
- **D8:** la agenda carga tramos de 28 días con una Server Action, en el patrón de `loadMonthMarks`. Descartado un Route Handler de lectura: añade una ruta pública que proteger en `getRouteAccess` y no aporta nada. Descartado también cargar un año de golpe, por coste y por superar el límite de 1.000 filas de PostgREST. Cubre: RF-48, RF-49.
- **D9:** como mucho 120 días en el DOM; al pasar del límite se sueltan tramos del extremo contrario. Descartada la virtualización por filas, que es más código y no hace falta con 120 días (RNF de rendimiento). Cubre: RNF.
- **D10:** el título de la cabecera de la agenda se calcula con `IntersectionObserver` sobre las bandas de mes y los días. Descartado leer `scrollY` en cada evento de scroll, que obliga a hacer trabajo en cada fotograma. Cubre: RF-59.
- **D11:** la agenda pierde el botón "Hora actual" (spec 008 RF-23) y el "+" de cada día (spec 005). Los sustituyen "Hoy" (RF-10, RF-58), el botón flotante (RF-17), la tecla N y "Nuevo evento" en el escritorio. Descartado conservarlos, porque la spec 016 pide la composición de Google, que no los tiene. Cubre: RF-47, RF-52, RF-60.
- **D12:** un componente `EventBlock` con tres formas sustituye a `EventChip` y `EventRow`. Descartado modificar los dos que ya existen, porque la regla de color y texto (RF-1–RF-5) quedaría repartida en dos sitios. Cubre: RF-1–RF-5.
- **D13:** el avatar usa `display_name`, que se lee en `getAppearance` (una consulta, ya en el marco), con el tinte de `assignTints` para el propio usuario. Descartada una consulta aparte en `TopBar`, porque sería otro viaje a la base de datos en cada página. Cubre: RF-6, RF-11.
- **D14:** la franja de 769 a 1023 px conserva la barra inferior actual. Descartado ampliar la cabecera móvil hasta 1023 px, porque contradice RF-61 ("> 768 px, marco actual"). Cubre: RF-61.
- **D15:** el portal de filtros y el contexto de la cabecera se montan solo mientras `usePathname()` es el calendario, y se limpian en la función de limpieza del efecto. Descartado confiar en que Activity oculte el portal: con `cacheComponents`, la página del calendario sigue montada y oculta (trampa conocida). Cubre: RF-13, casos límite (otras pantallas).

## Trazabilidad RF → módulo

| RF | Módulos |
|----|---------|
| RF-1 | event-block, event-chip (retirada) |
| RF-2 | event-block |
| RF-3 | palette-contrast |
| RF-4 | event-block |
| RF-5 | event-block |
| RF-6 | top-bar, app-frame, breakpoints |
| RF-7 | app-frame, breakpoints |
| RF-8 | top-bar, header-context, workspace |
| RF-9 | top-bar |
| RF-10 | top-bar, workspace, view-toolbar |
| RF-11 | top-bar, app-frame |
| RF-12 | top-bar, nav-drawer |
| RF-13 | nav-drawer, header-context, workspace, use-is-phone |
| RF-14 | nav-drawer |
| RF-15 | nav-drawer, swipe |
| RF-16 | nav-drawer |
| RF-17 | fab, workspace |
| RF-18 | fab |
| RF-19 | workspace, breakpoints |
| RF-20 | top-bar, month-strip, title-picker |
| RF-21 | month-strip |
| RF-22 | month-strip |
| RF-23 | top-bar, title-picker |
| RF-24 | title-picker |
| RF-25 | swipe, workspace, use-is-phone |
| RF-26 | swipe, workspace |
| RF-27 | swipe |
| RF-28 | swipe, workspace |
| RF-29 | workspace |
| RF-30 | month-view, skeleton |
| RF-31 | month-view |
| RF-32 | month-view |
| RF-33 | month-view |
| RF-34 | month-lanes, month-view, event-block |
| RF-35 | month-lanes, month-view |
| RF-36 | month-lanes, month-view |
| RF-37 | month-view |
| RF-38 | time-grid |
| RF-39 | time-grid |
| RF-40 | time-grid |
| RF-41 | time-grid, event-block |
| RF-42 | event-block, time-grid |
| RF-43 | time-grid |
| RF-44 | time-grid |
| RF-45 | time-grid |
| RF-46 | time-grid, month-view |
| RF-47 | agenda-view, agenda-feed, view-toolbar |
| RF-48 | agenda-loader, agenda-view |
| RF-49 | agenda-loader, agenda-view |
| RF-50 | agenda-feed, agenda-view, design-guard |
| RF-51 | agenda-feed, agenda-view |
| RF-52 | agenda-feed, agenda-view |
| RF-53 | agenda-feed, agenda-view |
| RF-54 | agenda-feed, event-block |
| RF-55 | agenda-feed, event-block |
| RF-56 | event-block |
| RF-57 | agenda-feed, agenda-view |
| RF-58 | agenda-feed, agenda-view |
| RF-59 | agenda-view, header-context |
| RF-60 | agenda-view |
| RF-61 | app-frame, view-toolbar, breakpoints |
| RF-62 | workspace (sin tocar atajos, ventanas, filtros ni permisos; tests existentes en verde) |
| RF-63 | design-guard, validation |

## Riesgos y mitigaciones

- **R1: deslizar choca con el desplazamiento horizontal o con el gesto de "atrás" de iOS.** Mitigación: semana y día ya no se desplazan en horizontal en el móvil (D5). No se intenta bloquear el gesto del borde de iOS (caso límite aceptado en la spec).
- **R2: un toque largo o un arrastre para crear (ratón) se toma por deslizamiento.** Mitigación: el hook solo atiende `touch`, y crear arrastrando solo existe con el ratón (spec 008). Un toque corto sigue siendo un clic, porque se exigen 50 px.
- **R3: corregir el scroll al añadir arriba da saltos en iOS con desplazamiento inercial.** Mitigación: añadir arriba solo cuando el centinela entra con un margen de 1.500 px, y corregir en `useLayoutEffect` antes de pintar. Prueba en un iPhone real.
- **R4: el portal de filtros queda vivo en otra pantalla por Activity.** Mitigación: D15 y una prueba con `playwright-cli` (calendario → Ajustes → abrir ≡: no hay filtros).
- **R5: el `ResizeObserver` del mes da otro número de carriles en el primer render (servidor) que en el cliente.** Mitigación: el servidor pinta con un valor por defecto de 3 carriles y el cliente corrige en un efecto; la fila ya tiene su altura final, así que no salta el diseño.
- **R6: la cabecera fija de semana y día y la `TopBar` se tapan.** Mitigación: `top` de la cabecera de días igual a la altura de la `TopBar` en `phone` (variable CSS `--top-bar-h`).
- **R7: hay tests de componentes que buscan textos o roles que desaparecen** ("Hora actual", "+N más", filas de agenda). Mitigación: se reescriben en la misma tarea que cambia el componente, con test primero.
- **R8: las 7 columnas de la semana en 390 px dejan unos 47 px por día.** Mitigación: el texto se parte en varias líneas y se recorta (RF-42), como en las capturas de Google. El título siempre es visible (RF-5).

## Pasos fuera del repositorio (los ejecuta el usuario)

Ninguno: no hay migraciones ni variables nuevas. Se publica con el `git push` y el merge a `main` de siempre.

## Dudas abiertas

- Ninguna bloqueante.
