# Plan 002 — Calendarios y eventos

> Spec de origen: `specs/002-calendarios-y-eventos/spec.md` (aprobada). Constitución: `docs/constitution.md`. Estado: **Aprobado** y cerrado con la spec (2026-10-21).

## Resumen de arquitectura

Se amplía el monolito Next.js de la spec 001 sin tocar el stack ni añadir dependencias. La base de datos sigue siendo la frontera de seguridad: una migración nueva añade categorías, preferencias de vista y dos funciones SQL (juntar calendarios y listar personas), todo con RLS. La interfaz son Server Components que leen con la sesión del usuario, Server Actions que escriben, y tres vistas de calendario (mes, semana, día) construidas a mano con CSS Grid sobre lógica de fechas pura y testeada.

```
Navegador ─ /dashboard (panel) ─────────────┐
          ─ /dashboard/calendar (vistas) ───┤  Server Components → src/lib/calendar/queries (RLS)
          ─ /dashboard/calendars/** ────────┤  Server Actions    → zod → Supabase (insert/update/delete/rpc)
          ─ /dashboard/events/** ───────────┘
                                   Supabase: calendars · event_categories · events (+color, +category_id)
                                             calendar_preferences · person_preferences
                                             rpc merge_calendars · rpc visible_people
```

Capas: `lib/calendar` (puro: paleta, zonas horarias, rangos, disposición, esquemas zod) → `lib/calendar/queries` (acceso a datos, solo servidor) → Server Actions → componentes.

## Módulos y responsabilidades

Lógica pura (`src/lib/calendar/`), sin red ni React; todo testeable con Vitest:

- `palette.ts`: paleta cerrada de 12+ colores pastel (incluye `#2563EB`) y `readableTextColor(bg)`, que elige blanco o `ink` según el contraste. No sabe nada de calendarios. Cubre: RF-2, RF-17, RNF contraste.
- `time-zone.ts`: `zonedLocalToUtc(local, tz)`, `utcToZonedParts(instant, tz)` y formateo con `Intl`. No conoce eventos. Cubre: RF-34, RF-20 (fechas), casos límite de cambio de hora y medianoche.
- `ranges.ts`: calcula el rango visible de cada vista (mes con semanas completas desde lunes, semana, día), navegación anterior/siguiente/hoy y parseo de `?view=&date=`. Cubre: RF-29, RF-30.
- `layout.ts`: reparte eventos por día (un evento que cruza medianoche o abarca varios días aparece en cada día), separa día completo/varios días de los eventos con hora, calcula columnas de solapamiento y el recorte "+N más". Cubre: RF-21, RF-35, RF-39, RF-40 y los casos límite de medianoche y varios días.
- `schemas.ts`: esquemas `zod` de calendario, categoría, evento y juntar (límites 50/500, 40, 100/2000/200, paleta, fin ≥ inicio, categoría del mismo calendario). Cubre: RF-1, RF-2, RF-4, RF-9, RF-15, RF-16, RF-18, RF-19, RF-20.
- `error-messages.ts`: traduce errores de Postgres (23505 duplicado, 42501 permisos, FK, `P0002` calendario inexistente) a español. Cubre: RF-8, RF-10, RF-14, RF-25, RF-28, RF-53.
- `grouping.ts`: `groupByPerson(calendars, people, prefs)` ordena personas y calendarios (yo primero; orden manual; sin posición al final por fecha de creación) y marca visibilidad (por defecto visible). Cubre: RF-42, RF-45, RF-47.

Acceso a datos (servidor):

- `queries.ts`: `getMyCalendars`, `getEventsInRange(from, to)`, `getCategories`, `getPeople` (RPC `visible_people`), `getPreferences`, `getEventById`, `getProfileTimeZone`. Solo lectura; confía en RLS. Cubre: RF-13/31, RF-36, RF-42, RF-46.

Server Actions (estado tipado con `fieldErrors`/`formError`/`values`, `redirect()` fuera del `try`):

- `src/app/dashboard/calendars/actions.ts`: `createCalendar`, `updateCalendar`, `deleteCalendar`, `mergeCalendars`. Cubre: RF-1, 3, 4, 5, 8, 49–54.
- `src/app/dashboard/calendars/[id]/categories/actions.ts`: `createCategory`, `renameCategory`, `deleteCategory`. Cubre: RF-9–12, 14.
- `src/app/dashboard/events/actions.ts`: `createEvent`, `updateEvent`, `deleteEvent`. Cubre: RF-15–28 (acción), RF-22–24.
- `src/app/dashboard/calendar/preferences-actions.ts`: `setCalendarVisibility`, `setPersonVisibility`, `saveOrder`. Cubre: RF-43–46, 48.

Páginas (todas bajo `/dashboard`, ya protegidas por `getRouteAccess`):

- `/dashboard` (modificada): lista de calendarios ordenada por preferencias, con accesos a crear, editar, categorías y juntar. Cubre: RF-7, RF-41, RF-45.
- `/dashboard/calendar`: vistas mes/semana/día + panel de filtros. Cubre: RF-29–40, 42–44.
- `/dashboard/calendars/new`, `/dashboard/calendars/[id]/edit`, `/dashboard/calendars/[id]/categories`, `/dashboard/calendars/merge`. Cubre: RF-1–8, 9–14, 49–55.
- `/dashboard/events/new` y `/dashboard/events/[id]` (detalle + edición + borrado). Cubre: RF-15–28, 36.

Componentes (`src/components/calendar/`, cada uno una responsabilidad):

- `month-view`, `week-view`, `day-view`: pintan lo que calcula `layout.ts`; `view-toolbar` (selector de vista, anterior/siguiente/hoy); `event-chip`. Cubren: RF-29, 30, 35, 37–40.
- `calendar-filters` (Client): árbol personas → calendarios → categorías, casillas, botones subir/bajar. Cubre: RF-32, 33, 42–47.
- `color-picker` (radiogroup accesible de la paleta), `event-form`, `calendar-form`, `category-manager`, `merge-form`, `confirm-dialog` (`<dialog>` nativo con título y texto de aviso). Cubren: RF-2, 6, 24, 52 y formularios.
- `calendar-list` (existente, ampliado). Cubre: RF-41.

SQL (migración nueva, ver Modelo de datos): `merge_calendars`, `visible_people`, triggers de categoría. Cubre: RF-5, 10–12, 27, 28, 42, 49–54.

No hacen: ningún módulo decide permisos (RLS los impone); ninguno toca `public/sw.js` (no se cachean datos, ver D10); no hay nada de invitaciones, `.ics`, recurrencia ni perfil.

## Modelo de datos

Una sola migración nueva: `supabase/migrations/<timestamp>_calendars_and_events.sql` (nunca se edita lo ya aplicado).

### Tablas nuevas (todas con RLS, `created_at`; las editables con `updated_at`)

- `event_categories { id uuid pk, calendar_id → calendars on delete cascade, name text, created_at, updated_at }`
  - `check (char_length(trim(name)) between 1 and 40)`.
  - Índice único `(calendar_id, lower(trim(name)))` (RF-10).
  - Índice único `(id, calendar_id)` (soporta la FK compuesta de `events`).
- `calendar_preferences { user_id → profiles cascade, calendar_id → calendars cascade, visible boolean default true, position integer, created_at, updated_at; pk (user_id, calendar_id) }`.
- `person_preferences { user_id → profiles cascade, person_id → profiles cascade, position integer, created_at, updated_at; pk (user_id, person_id) }`.
  - La visibilidad de una persona no se guarda: es la de sus calendarios (RF-44).

### Cambios en tablas existentes

- `events`: añadir `color text null check (color ~ '^#[0-9A-Fa-f]{6}$')` y `category_id uuid null`.
  - FK compuesta `(category_id, calendar_id) → event_categories (id, calendar_id)` con `on delete set null (category_id)` y `deferrable initially immediate`. Garantiza RF-28 y RF-12.
- Límites del esquema alineados con la spec: `calendars.name` ≤ 50, `events.title` ≤ 100, `events.description` ≤ 2000, `events.location` ≤ 200 (sustituyen los checks de 80/200/5000/300). RF-4, RF-19, RF-16.
- La paleta **no** se impone en SQL (solo hex válido): la valida `zod`; ver R3.

### Funciones y triggers

- `events_reset_category` (before update of `calendar_id` en `events`): si `category_id` ya no pertenece al nuevo calendario, lo deja en `null`. RF-27.
- `event_categories_set_updated_at`, `calendar_preferences_set_updated_at`, `person_preferences_set_updated_at`: reutilizan `set_updated_at`.
- `visible_people()`: `security definer`, `search_path = ''`, devuelve `(id, display_name)` del propio usuario y de los propietarios de los calendarios de los que es miembro. Solo `authenticated`. RF-42.
- `merge_calendars(p_source_ids uuid[], p_target_id uuid default null, p_name text default null, p_color text default null) returns uuid`: `security invoker`, en una sola transacción (RF-54):
  1. Exige ≥ 2 calendarios y que el usuario sea `owner` de todos (`42501` si no, RF-53).
  2. Si `p_target_id` es nulo crea el calendario nuevo con nombre y color; si no, comprueba que está entre los origen (RF-50).
  3. Marca la FK de categoría como diferida; reasigna los eventos cuya categoría coincide por nombre normalizado con una del destino (RF-51); mueve las demás categorías; mueve los eventos al destino.
  4. Borra los calendarios origen restantes (sus miembros y preferencias caen en cascada; el destino conserva los suyos, RF-55) y devuelve el id del destino.

### Políticas RLS (rol `authenticated`; `anon` sin políticas)

| Tabla | Leer | Escribir |
|-------|------|----------|
| `event_categories` | Miembros del calendario (RF-13) | Insertar, modificar y borrar: owner y editor (RF-9, 11, 14) |
| `calendar_preferences` | Solo `user_id = auth.uid()` (RF-48) | Insertar/modificar/borrar solo las propias, y solo de calendarios de los que es miembro |
| `person_preferences` | Solo las propias | Solo las propias |
| `events`, `calendars` | Sin cambios (001) | Sin cambios: el cambio de calendario de un evento ya exige owner/editor en origen y destino por `using` + `with check` (RF-27) |

Tras la migración: `npm run db:push` (dev), `npm run db:types`. El script `list_tables_without_rls` ya cubre las tablas nuevas (P3).

### Formato de fechas

- Eventos con hora: instante UTC (`timestamptz`), mostrado en la zona del perfil.
- Día completo: `all_day = true`, `starts_at` a las 00:00 **UTC** del primer día y `ends_at` a las 00:00 UTC del día siguiente al último; se muestra por fecha UTC, sin convertir a la zona del lector (D6).
- Consulta de rango `[from, to)`: `starts_at < to and ends_at >= from`.

## Contratos e interfaces

### Rutas y parámetros

| Ruta | Parámetros | Notas |
|------|-----------|-------|
| `/dashboard/calendar` | `?view=month\|week\|day` (def. `month`), `?date=YYYY-MM-DD` (def. hoy en la zona del perfil) | Valores inválidos → valores por defecto |
| `/dashboard/calendars/new` | — | |
| `/dashboard/calendars/[id]/edit` | — | Solo owner; si no es owner → 404 |
| `/dashboard/calendars/[id]/categories` | — | Owner/editor; lector → 404 |
| `/dashboard/calendars/merge` | — | |
| `/dashboard/events/new` | `?calendar=<id>&date=YYYY-MM-DD` opcionales (precargan el formulario) | |
| `/dashboard/events/[id]` | — | Detalle; con permisos, formulario de edición y borrado |

### Estado de las Server Actions

`FormState<Field> = { fieldErrors?: Partial<Record<Field,string>>; formError?: string; values: Record<Field,string> }` (tipo genérico nuevo en `src/lib/forms/form-state.ts`; no se modifica el de auth). Éxito → `redirect()`; error de red o desconocido → "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo." conservando lo escrito.

### Campos de formularios

- Calendario: `name`, `description`, `color`.
- Categoría: `name` (+ `calendarId`, `id`).
- Evento: `title`, `calendarId`, `allDay`, `startDate`, `startTime`, `endDate`, `endTime`, `description`, `location`, `color` (vacío = el del calendario), `categoryId` (vacío = sin categoría).
  - Con `allDay` solo `startDate`/`endDate` (fin = último día inclusivo en el formulario; se guarda exclusivo).
- Juntar: `sourceIds[]` (≥ 2), `targetId` (uno de ellos) o `newName` + `newColor`.

### Mensajes de error (español)

| Origen | Mensaje |
|--------|---------|
| fin < inicio | "El fin no puede ser anterior al inicio." |
| nombre/título vacío o largo | "Escribe un nombre de 1 a N caracteres." |
| categoría duplicada | "Ya existe una categoría con ese nombre." |
| permisos (`42501`/RLS) | "No tienes permiso para hacer esto." |
| calendario/evento inexistente | "Este elemento ya no existe." |
| juntar sin ser propietario | "Solo puedes juntar calendarios de los que eres propietario." |

### Preferencias

- `setCalendarVisibility(calendarId, visible)`, `setPersonVisibility(personId, visible)` (aplica a todos sus calendarios), `saveOrder({ people: id[], calendars: Record<personId, id[]> })`: hacen `upsert` de las filas propias. Devuelven `{ ok } | { error }`; la interfaz es optimista y revierte si falla.

## Flujo principal paso a paso

1. El usuario entra en `/dashboard`: el panel lista sus calendarios en su orden guardado y muestra "Nuevo calendario", "Juntar" y "Abrir calendario" (RF-41, RF-45). Sin calendarios → estado vacío con "Crear calendario" (RF-7).
2. Crea un calendario (RF-1–4): formulario → `calendarSchema` → `insert` (RLS) → el trigger de 001 crea su fila `owner` → vuelve al panel.
3. Crea una categoría en `/dashboard/calendars/[id]/categories` (RF-9, RF-10): `categorySchema` → `insert`; el índice único devuelve `23505` → "Ya existe…".
4. Crea un evento (RF-15–21): `eventSchema` convierte fecha/hora local → UTC con `time-zone.ts` usando la zona del perfil (o fechas UTC si es de día completo); valida fin ≥ inicio; `insert`; la FK compuesta impide categorías de otro calendario (RF-28).
5. Abre `/dashboard/calendar` (RF-30): el servidor calcula el rango con `ranges.ts`, lee en paralelo calendarios, categorías, preferencias, personas y eventos del rango (RF-31) y entrega los datos a una vista cliente.
6. La vista aplica en el cliente el filtro de calendarios y categorías visibles (RF-33, RF-43, RF-44), reparte eventos con `layout.ts` (RF-35, 39, 40) y pinta mes/semana/día con la hora en la zona del perfil (RF-34). Pulsar un día del mes abre la vista diaria (RF-37); pulsar un evento abre su detalle (RF-36). Periodo vacío → "No hay eventos" (RF-38).
7. Cambiar visibilidad u orden actualiza la interfaz al instante y llama a la acción de preferencias, que hace `upsert` (RF-45, RF-46); al volver a entrar se recuperan.
8. Edita o borra un evento (RF-22–24): `updateEvent`/`deleteEvent`; el borrado pasa por `confirm-dialog`. Un Lector no ve botones (RF-26) y, si fuerza la petición, RLS rechaza (RF-25).
9. Juntar (RF-49–54): `merge-form` lista los calendarios propios; el resumen (cuáles desaparecen, cuántos eventos se mueven) sale de una consulta de recuento antes de confirmar (RF-52); la acción llama a `rpc('merge_calendars')`; todo o nada (RF-54); redirige al panel.
10. Borrar un calendario (RF-5, 6): `confirm-dialog` con nombre y aviso; `delete` en cascada.

## Decisiones técnicas

- D1: **Vistas de calendario construidas a mano** con CSS Grid y lógica pura en `lib/calendar`. Descartadas FullCalendar y react-big-calendar por ser dependencias nuevas (P6), con estilos difíciles de ajustar a los tokens de marca y a 360 px, y porque las tres vistas necesarias son pequeñas. No se añade ninguna dependencia, así que no hace falta aprobación de P6. Cubre: RF-29–40.
- D2: **Fechas y zonas con `Intl` nativo** (sin date-fns, luxon ni `Temporal` aún no estable en todos los navegadores objetivo). Descartada una librería de fechas por P6. Cubre: RF-34, RNF.
- D3: **Categorías en tabla propia por calendario** con FK compuesta desde `events`. Descartado un campo de texto libre en el evento porque no permite renombrar/borrar en bloque (RF-11) ni garantizar RF-28. Cubre: RF-9–14, 28.
- D4: **Preferencias en tablas `calendar_preferences` y `person_preferences`** con filas creadas bajo demanda; sin fila = visible y al final. Descartado `localStorage` porque RF-46 exige que sigan al usuario entre dispositivos; descartado un trigger que cree filas al compartir (acoplaría a la spec 003). Cubre: RF-45–48.
- D5: **Juntar calendarios con una función SQL `security invoker`** en una transacción. Descartado hacerlo desde el servidor con varias llamadas por no poder garantizar RF-54 (todo o nada) y por dejar la lógica de permisos fuera de la base de datos (P3). Cubre: RF-49–54.
- D6: **Eventos de día completo como fechas "flotantes" a las 00:00 UTC**, mostradas por fecha UTC. Descartado almacenarlos a medianoche de la zona del creador porque un cumpleaños se desplazaría de día para un lector en otra zona; respeta la convención de 001 (00:00 / fin exclusivo). Cubre: RF-20, RF-21.
- D7: **Filtrado de visibilidad en el cliente** sobre eventos del rango ya cargado. Descartado volver a pedir datos al servidor en cada casilla: la respuesta es instantánea y no hace falta red. Cubre: RF-32, RF-33, RF-43, RF-44.
- D8: **Reordenar con botones "Subir/Bajar"** (accesibles por teclado). Descartado arrastrar y soltar: dependencia o mucho código y accesibilidad más difícil. Cubre: RF-45.
- D9: **`visible_people()` (RPC definer) en vez de una política que abra `profiles`** a los co-miembros: expone solo `id` y `display_name`, no la zona horaria. Descartado ampliar la política `profiles_select_own`. Cubre: RF-42.
- D10: **El service worker no cambia**: ya solo cachea estáticos y nunca HTML con sesión ni respuestas de Supabase; un test comprueba que `sw.js` no menciona rutas de datos. Descartado cachear vistas por privacidad en dispositivos compartidos. Cubre: RNF PWA.
- D11: **Páginas completas, no modales,** para formularios; solo la confirmación usa `<dialog>` nativo. Descartado un sistema de modales por complejidad y por accesibilidad con teclado. Cubre: RF-6, RF-24, RF-52.
- D12: **Estado de la vista en la URL** (`?view=&date=`). Descartado estado en cliente para que la vista sea enlazable, funcione con atrás/adelante y se renderice en el servidor. Cubre: RF-29, RF-30, RF-37.
- D13: **Contraste de la paleta pastel resuelto con `readableTextColor`**: texto `ink` o blanco, el de mayor contraste, y un test que exige ≥ 4,5:1 para cada color de la paleta. Descartado un color de texto fijo (`#2563EB` no alcanza 4,5:1 con `ink`). Cubre: RNF accesibilidad; resuelve la duda de la spec.
- D14: **Rendimiento**: consulta de eventos acotada por rango y columnas mínimas, con el índice `(calendar_id, starts_at)` existente; sin paginación (500 eventos/mes). Descartado cargar todos los eventos y filtrar en el cliente. Cubre: RNF rendimiento.

## Trazabilidad RF -> módulo

| RF | Módulos |
|----|---------|
| RF-1 | `schemas`, `calendar-form`, `calendars/actions` |
| RF-2 | `palette`, `color-picker`, `schemas` |
| RF-3 | `calendars/actions`, `calendar-form`, panel |
| RF-4 | `schemas`, `error-messages`, SQL (checks) |
| RF-5, RF-6 | `calendars/actions`, `confirm-dialog` |
| RF-7 | panel `/dashboard`, `calendars/actions` |
| RF-8 | RLS (001), `error-messages`, página `edit` |
| RF-9 | `category-manager`, `categories/actions`, tabla `event_categories` |
| RF-10 | índice único, `error-messages` |
| RF-11, RF-12 | `categories/actions`, FK `on delete set null` |
| RF-13 | RLS `event_categories`, `queries` |
| RF-14 | RLS, `error-messages` |
| RF-15 | `event-form`, `events/actions`, `schemas` |
| RF-16 | `schemas`, `event-form`, SQL (checks, `color`, `category_id`) |
| RF-17 | `palette`, `event-chip` |
| RF-18, RF-19 | `schemas`, `error-messages` |
| RF-20, RF-21 | `time-zone`, `schemas`, `layout`, D6 |
| RF-22 | `events/actions`, `event-form` |
| RF-23, RF-24 | `events/actions`, `confirm-dialog` |
| RF-25 | RLS `events` (001) |
| RF-26 | `event-form`/detalle según rol, páginas de eventos |
| RF-27 | RLS `events`, trigger `events_reset_category`, `event-form` |
| RF-28 | FK compuesta |
| RF-29 | `ranges`, `view-toolbar`, vistas |
| RF-30 | `ranges`, página `/dashboard/calendar` |
| RF-31 | `queries`, página `/dashboard/calendar` |
| RF-32, RF-33 | `calendar-filters`, D7 |
| RF-34 | `time-zone`, vistas |
| RF-35 | `layout`, vistas |
| RF-36 | `events/[id]` |
| RF-37 | `month-view`, `ranges` |
| RF-38 | vistas |
| RF-39 | `layout`, `month-view` |
| RF-40 | `layout`, `week-view`, `day-view` |
| RF-41 | panel `/dashboard`, `calendar-list` |
| RF-42 | `visible_people`, `grouping`, `calendar-filters` |
| RF-43, RF-44 | `calendar-filters`, `preferences-actions` |
| RF-45 | `grouping`, `calendar-filters`, `preferences-actions`, panel |
| RF-46 | `calendar_preferences`, `person_preferences`, `queries` |
| RF-47 | `grouping` (sin fila = visible y al final) |
| RF-48 | RLS de preferencias |
| RF-49, RF-50, RF-51 | `merge_calendars`, `merge-form`, `calendars/actions` |
| RF-52 | `merge-form`, `confirm-dialog`, consulta de recuento |
| RF-53 | `merge_calendars` (`42501`), `error-messages` |
| RF-54 | `merge_calendars` (transacción única) |
| RF-55 | `merge_calendars` (los miembros de los origen caen en cascada; el destino conserva los suyos) |

## Riesgos y mitigaciones

- R1: **Aritmética de zonas horarias sin librería** (cambios de hora, horas inexistentes en primavera). Mitigación: `time-zone.ts` con tests por zona y fechas de cambio (Europe/Madrid, America/New_York); una hora inexistente se resuelve con la siguiente válida y una ambigua con la primera ocurrencia.
- R2: **Next 16 con `cacheComponents`**: `searchParams`, `cookies()` y sesión solo dentro de `<Suspense>`. Mitigación: leer `node_modules/next/dist/docs/` antes de la primera página nueva y copiar el patrón `getCurrentUserId` del panel.
- R3: **Paleta solo validada por la aplicación**, no por SQL: un cliente malicioso podría guardar un hex arbitrario. Mitigación: aceptado (solo afecta a su propio contenido; sigue siendo hex válido, sin inyección); `readableTextColor` funciona con cualquier hex.
- R4: **Complejidad de `merge_calendars` con la FK compuesta** (orden de actualización de eventos y categorías). Mitigación: FK `deferrable initially immediate` y `set constraints … deferred` dentro de la función; tests de base de datos de todos los caminos (nombres duplicados, destino nuevo, fallo a mitad).
- R5: **Endurecer los checks de longitud** podría fallar con datos existentes. Mitigación: comprobar en dev y prod antes del `db push` (hoy solo existe "Mi calendario" y datos de prueba).
- R6: **Disposición de eventos solapados** (algoritmo de columnas). Mitigación: tests unitarios con casos de solape en cadena, igualdad de bordes y eventos de duración cero.
- R7: **`test:db` intermitente** (conocido). Mitigación: repetir la ejecución antes de investigar.
- R8: **Los tests de múltiples personas (RF-42, RF-45) no pueden usar compartición real** porque la spec 003 aún no existe. Mitigación: los tests de base de datos insertan membresías con la clave secreta solo en `tests/`.
- R9: **Edición simultánea**: gana el último guardado, sin aviso (aceptado en la spec).

## Dudas abiertas

- [NECESITA ACLARACIÓN] RF-55 (heredada de la spec): con compartición real (spec 003), juntar calendarios con miembros distintos descartaría a los miembros de los calendarios origen. Aquí no se da el caso (un único miembro por calendario); se revisará en la 003.
- [NECESITA ACLARACIÓN] ¿Aceptas que el día completo sea una fecha flotante en UTC (D6)? Evita desplazar cumpleaños entre zonas, pero un evento de día completo no se ajusta a la zona del lector.
