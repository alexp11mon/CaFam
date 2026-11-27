# Plan 054 — Pantalla "Ahora"

Spec: `specs/054-pantalla-ahora/spec.md`.

> Estado: **Aprobado** por el usuario el 2026-11-27, con la spec y las tareas. D6 resuelve la duda de la barra inferior de la spec.

## Resumen de arquitectura

Se añade una página nueva `/dashboard/now` (Server Component dentro de `<Suspense>`). Lee lo mismo que ya lee el calendario: perfil, calendarios, personas, preferencias, eventos y bloques "Ocupado" de las personas marcadas. La lectura es más corta: desde el inicio de hoy hasta el final de mañana, en la zona del perfil. Con esos datos, una función pura (`buildNowCards`) construye las tarjetas para un instante dado. Un componente cliente (`NowBoard`) la vuelve a ejecutar cada vez que cambia `useNow()` y refresca la página con `useLiveCalendar`. Sin conexión, la app sin conexión (034) llama a la misma función con la copia local. La pantalla de inicio se resuelve en un solo sitio, `/dashboard`, que lee `profiles.home`. No hay permisos nuevos ni funciones SQL nuevas: solo una columna en `profiles`.

```
/dashboard/now (servidor) ──getEventsInRange / getBusyIntervals / getMyCalendars / getPeople / getPreferences
        │  props serializables (registros, calendarios, personas, preferencias, ocupados)
        ▼
NowBoard (cliente) ── useNow() cada 30 s ──► buildNowCards(datos, now, zona) ──► NowCard × N
        └─ useLiveCalendar(userId) ─► router.refresh()          (RF-19, RF-20)
OfflineApp ── ruta "now" ──► NowBoard con la copia (eventsOf) y busy = null      (RF-21, RF-22)
/ , /dashboard , manifest, getSafeNextPath ──► /dashboard ──profiles.home──► /dashboard/now | /dashboard/calendar   (RF-24–RF-26)
```

## Módulos y responsabilidades

| Módulo | Qué hace | Qué no hace | RF |
|--------|----------|-------------|----|
| `src/lib/now/cards.ts` (nuevo, puro) | `buildNowCards(input, now)`: decide las personas seguidas, su orden y, para cada una, el texto de "Ahora", "Después" y "Hoy" | No lee datos ni conoce React | RF-1–RF-15 |
| `src/lib/now/window.ts` (nuevo, puro) | `nowWindow(now, timeZone)`: desde las 00:00 de hoy hasta las 00:00 de pasado mañana, en la zona del perfil | No lee datos | RF-10, RF-11, RF-19 |
| `src/app/dashboard/now/page.tsx` (nuevo) | Lee los datos con la sesión y pasa props serializables a `NowBoard`; título "Ahora" | No calcula tarjetas | RF-1, RF-6, RF-13, RF-20 |
| `src/components/now/now-board.tsx` (nuevo, cliente) | Recalcula con `useNow()`; refresca con `useLiveCalendar`; vuelve a leer al cambiar de día; muestra el estado vacío | No lee Supabase | RF-1, RF-19, RF-20, RF-27 |
| `src/components/now/now-card.tsx` (nuevo, cliente) | Una tarjeta: región con el nombre, línea "Hoy", "Ahora", "Después"; anuncia solo los cambios de estado | No decide contenido | RF-7–RF-14, RF-16, RF-17, RF-18 |
| `src/lib/shell/nav.ts` + `components/shell/icons.tsx` | Sección `now` (primera), icono `NowIcon`, barra inferior | — | RF-23 |
| `src/lib/calendar/ranges.ts` + `calendar-client.tsx` | Parámetro `only=<personId>` de la URL: solo los calendarios de esa persona en esa visita, con un aviso "Viendo solo a X · Ver todos" | No guarda filtros | RF-17 |
| `src/app/dashboard/page.tsx` | Lee `profiles.home` y redirige a `/dashboard/now` o `/dashboard/calendar` | — | RF-25 |
| `src/app/page.tsx`, `src/app/manifest.ts`, `lib/auth/next-path.ts` | Llevan a `/dashboard` en lugar de `/dashboard/calendar` | Los destinos con contexto (`join`, `invite`, `reset-password`) no cambian | RF-25 |
| `components/settings/home-setting.tsx` (nuevo) + `settings/actions.ts` (`saveHome`) + `settings/page.tsx` | Selector "Pantalla de inicio" que guarda al momento, como el tema | — | RF-24, RF-26 |
| `supabase/migrations/<fecha>_profile_home.sql` (nueva) | `profiles.home text not null default 'calendar' check (home in ('calendar','now'))` | No crea políticas: valen las de `profiles` | RF-24, RF-26 |
| `lib/calendar/queries.ts` (`getCalendarProfile`) | Devuelve `home` | — | RF-25 |
| `components/offline/offline-router.tsx` + `offline-app.tsx` + `lib/offline/snapshot.ts` | Ruta `now`; `/dashboard` sin conexión elige según `profile.home` de la copia; `NowBoard` con `eventsOf(copy, …)` | No cambia `sw.js` (cualquier `/dashboard/*` ya va a la app sin conexión) | RF-21, RF-22, RF-25 |
| `src/i18n/en/now.ts` (nuevo) | Textos en inglés | — | RNF idioma |

## Modelo de datos

- **`profiles.home`**: `text not null default 'calendar'`, `check (home in ('calendar', 'now'))`. Lo leen y escriben las políticas existentes de `profiles` (solo su dueño). No avisa por tiempo real: el cambio vale en la siguiente apertura (RF-26).
- **`OfflineProfile.home?: "calendar" | "now"`**: es opcional, así que una copia antigua sigue siendo válida (se toma `"calendar"`) y no hace falta subir `SNAPSHOT_FORMAT`.
- **Entrada de `buildNowCards`** (todo ya existe en el calendario):
  - `userId`, `timeZone`;
  - `calendars: { id, name, ownerId, color }[]`;
  - `people: { id, displayName }[]`;
  - `preferences` (orden de personas y visibilidad por calendario);
  - `events: { id, calendarId, title, startsAt, endsAt, allDay, location }[]`, ya expandidos;
  - `busy: BusyInput[] | null` (`null` = sin datos, sin conexión);
  - `busyPeople: BusyPerson[]`.
- **Salida**: `NowCardData[]` con `{ person: { id, name, isMe }, today: Event[], current: { events: Event[2], more: number } | { busyUntil } | { freeUntil?: string } | { noData }, next: Event | null | "none" }`. Todo con instantes ISO; el formato lo pone el componente con `dateFormat(locale)`.

## Contratos e interfaces

- **Ruta** `GET /dashboard/now`: protegida por el prefijo `/dashboard` de `getRouteAccess` (sin cambios). Sin parámetros.
- **Ruta** `GET /dashboard/calendar?view=day&date=<hoy>&only=<personId>` (RF-17): `only` solo vale si es el id de una persona que el usuario sigue; si no, se ignora. Con `only`, la visibilidad efectiva es `calendar.ownerId === only`, el panel de filtros muestra el aviso y cualquier cambio de filtro quita `only` de la URL antes de guardar.
- **Server Action** `saveHome(home: "calendar" | "now"): Promise<{ error?: string }>`, validada con zod; error de conexión con `CALENDAR_MESSAGES.connection`.
- **Función** `buildNowCards(input, now: number): NowCardData[]` y `nowWindow(now: number, timeZone: string): { from: Date; to: Date; day: string }`.
- **Navegación**: `Section` gana `"now"`; `NAV_ITEMS[0] = { section: "now", href: "/dashboard/now", label: "Ahora" }`, sin `needsNetwork`; `BAR_SECTIONS = ["now", "calendar", "notes"]`; `"calendars"` pasa a ser la primera de `SHEET_SECTIONS` (D6).

## Flujo principal paso a paso

1. La madre abre la app instalada: `start_url` es `/dashboard`, que lee `home = 'now'` y redirige a `/dashboard/now` (RF-25).
2. La página lee en paralelo perfil, calendarios, personas, preferencias y `getBusyPeople`; con la zona, `nowWindow` da el rango y se leen `getEventsInRange` y `getBusyIntervals` (RF-6, RF-13).
3. `NowBoard` recibe los datos y llama a `buildNowCards(datos, useNow())`:
   1. Las personas seguidas son los dueños de calendarios visibles más los marcados en "Disponibilidad"; se ordenan con el usuario primero y luego por el orden guardado (RF-2–RF-5).
   2. Por persona, los eventos de sus calendarios visibles: en curso (`start ≤ now < end`, con hora), los de día completo de hoy y el siguiente con hora que empiece antes del final de mañana (RF-6–RF-12).
   3. Si no tiene eventos visibles en curso: los intervalos ocupados (`busyBlocks`) dan "Ocupado hasta" o "Libre hasta"; si `busy` es `null`, "Sin datos sin conexión" (RF-13, RF-14, RF-22).
4. Cada 30 s `useNow()` cambia y las tarjetas se recalculan; solo se anuncia una tarjeta si cambia su tipo de estado (RF-19, accesibilidad).
5. Un cambio en un calendario visible llega por `live_notify`, `useLiveCalendar` llama a `router.refresh()` y la página vuelve a leer (RF-20). Al pasar la medianoche, `NowBoard` también llama a `router.refresh()` para mover el rango.
6. Al pulsar un evento se abre `/dashboard/events/<id>` en la ventana `@modal` (RF-16). Al pulsar el nombre se abre `/dashboard/calendar?view=day&date=<hoy>&only=<id>` (RF-17).

## Decisiones

- **D1: lectura propia de 2 días**, no la ventana ancha del calendario. Descartado reutilizar `serverWindow` (semanas de eventos), porque "Ahora" solo necesita hoy y mañana y así cumple el umbral de 1 s. Cubre: RF-10, RF-11, RNF rendimiento.
- **D2: cálculo puro en el cliente con `useNow()`.** Descartado calcular en el servidor y refrescar cada minuto, porque gastaría una petición por minuto y no funcionaría sin conexión. Cubre: RF-19, RF-21.
- **D3: misma función para la página y la app sin conexión** (`buildNowCards` con `busy: null`). Descartada una variante sin conexión aparte, para no duplicar reglas (el bucle de `sw.js` ya está duplicado y es un riesgo conocido). Cubre: RF-21, RF-22.
- **D4: los ocupados salen de `getBusyIntervals` y se juntan con `busyBlocks`**, que ya quita lo que el usuario ve (spec 020 RF-12, RF-13). Descartada una función SQL nueva para "Ahora", porque `grid_busy` ya devuelve solo las personas marcadas y ya limita a 32 días. Cubre: RF-4, RF-13, RF-14.
- **D5: el inicio se resuelve en `/dashboard`, que lee `profiles.home`.** Todas las entradas (`/`, manifest, `getSafeNextPath`) apuntan ahí. Descartada una cookie leída en `proxy.ts`, porque sería por dispositivo y la spec pide que valga en todos (RF-26). Coste: una redirección más, que se mide en la T7. Cubre: RF-25, RF-26.
- **D6: barra inferior "Ahora · Calendario | + | Notas · Más"**, y "Mis calendarios" pasa a "Más". Descartado "Ahora · Calendario · Notas · Venito" (lo que proponía la spec), porque Venito ya tiene su propio botón y la barra admite dos destinos a cada lado del "+" (enmienda 10). "Mis calendarios" es lo que menos se abre a diario. Cubre: RF-23.
- **D7: `only=<personId>` como vista temporal de la URL.** Descartado cambiar los filtros guardados y restaurarlos después, porque se perderían al cerrar la app a medias. Cubre: RF-17.
- **D8: estados de tarjeta como unión discriminada en `NowCardData`**, para que el anuncio accesible compare solo el tipo de estado (`event`/`busy`/`free`/`noData`). Descartado comparar textos, porque cambian cada minuto ("hasta las…"). Cubre: RNF accesibilidad.

## Pasos de producción (los ejecuta el usuario)

1. Aplicar la migración `profile_home` a prod **antes de desplegar** (la página `/dashboard` la lee):
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```
2. Avisar de que el icono instalado en iOS sigue abriendo `/dashboard/calendar` hasta reinstalar. Funciona igual, pero no respeta "Pantalla de inicio".

## Trazabilidad RF → módulo

| RF | Módulo / decisión |
|----|-------------------|
| RF-1 | `now/page.tsx`, `NowBoard` |
| RF-2, RF-3, RF-4, RF-5 | `lib/now/cards.ts` |
| RF-6 | `lib/now/cards.ts`, `now/page.tsx` (D1) |
| RF-7, RF-8, RF-9, RF-10, RF-11, RF-12 | `lib/now/cards.ts`, `lib/now/window.ts`, `NowCard` |
| RF-13, RF-14 | `lib/now/cards.ts` (D4), `getBusyIntervals` |
| RF-15 | `lib/now/cards.ts` (zona), `NowCard` (`dateFormat`) |
| RF-16 | `NowCard` (enlace a la ventana `@modal`) |
| RF-17 | `NowCard`, `ranges.ts` + `calendar-client.tsx` (D7) |
| RF-18 | `NowCard` (sin acciones), `nav.ts` (el "+" global sigue en la barra, fuera de la pantalla) |
| RF-19 | `NowBoard` + `useNow()` (D2) |
| RF-20 | `NowBoard` + `useLiveCalendar` |
| RF-21, RF-22 | `offline-router`, `offline-app`, `buildNowCards` con `busy: null` (D3) |
| RF-23 | `nav.ts`, `icons.tsx` (D6) |
| RF-24, RF-26 | `home-setting.tsx`, `saveHome`, migración `profile_home` |
| RF-25 | `dashboard/page.tsx`, `app/page.tsx`, `manifest.ts`, `next-path.ts`, `offline-router` (D5) |
| RF-27 | `NowBoard` (estado vacío con enlace a `/dashboard/join`) |

## Riesgos

- **R1: la ventana `@modal/(.)events` desde `/dashboard/now`.** La intercepción se definió pensando en el calendario. Mitigación: test e2e en la T5; si no intercepta, se abre la página completa (sigue cumpliendo RF-16).
- **R2: redirección extra en el arranque (D5).** Mitigación: medir con `scripts/perf/` en la T7; si supera 1 s con caché caliente, se reconsidera con el usuario antes de cerrar.
- **R3: cambios de personas solo "Ocupado" sin aviso en tiempo real.** `live_notify` solo avisa a los miembros del calendario. RF-20 solo exige lo que el usuario "puede ver", pero conviene decirlo en el cierre. Mitigación: `useLiveCalendar` ya vuelve a leer al volver la pestaña al primer plano.
- **R4: `only` con un filtro de personas que mezcla grupos (007).** Mitigación: `only` compara por `ownerId`, no por la sección del panel; hay un test con un calendario dentro de un grupo.
- **R5: la barra inferior cambia para todos (D6).** Hay capturas de antes y después en la T7, y lo aprueba el usuario con este plan.

## Dudas abiertas

- Ninguna. La de la barra inferior (spec) quedó resuelta con D6 al aprobar el plan.
