# Plan 039 — Búsqueda de eventos

Spec: `specs/039-busqueda-de-eventos/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

- **Postgres**: `pg_trgm` y `unaccent`, una función inmutable `public.search_text(text)` (`lower(unaccent(...))`) e índices GIN de trigramas sobre la concatenación de título, lugar y descripción de `events` y sobre `event_comments.body`. La función `search_events(p_query text, p_from timestamptz, p_to timestamptz, p_limit int)` es `SECURITY INVOKER` (RLS manda), filtra por `calendar_id in (select calendar_id from calendar_members where user_id = auth.uid())` antes que nada y devuelve filas de evento (sueltos, series que pueden caer en el periodo y excepciones) con el comentario que coincide.
- **Servidor**: `searchEvents(query, range)` en `lib/search/queries.ts` llama a la función, expande las series con `expandRows` (como `getEventsInRange`) y filtra las repeticiones por el periodo y por coincidencia.
- **Puro**: `lib/search/` con `normalize` (minúsculas y sin tildes con `normalize("NFD")`, mismo criterio que SQL), `group` (por día en la zona del perfil, próximos y pasados), `highlight` (trozos para `<mark>`) y `recent` (últimas búsquedas).
- **Interfaz**: página `app/dashboard/search/page.tsx` con `SearchScreen` (cliente) y su acción `runSearch`; botón en `CalendarHeading` y `TopNav`; `/` en `SHORTCUTS`.
- **Sin conexión**: `offline-sources.ts` gana `searchOffline(query)` sobre la copia con `normalize`; `OfflineApp` registra la ruta `/dashboard/search` en `offline-router.tsx`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261120100000_event_search.sql` | Extensiones, `search_text`, índices GIN y `search_events` |
| `src/lib/search/normalize.ts`, `group.ts`, `highlight.ts`, `recent.ts`, `limits.ts` | Lógica pura (RF-3, RF-6 a RF-9) |
| `src/lib/search/queries.ts` | `searchEvents` con expansión de series (RF-4, RF-5) |
| `src/app/dashboard/search/page.tsx`, `actions.ts` | Ruta y acción `runSearch` |
| `src/components/search/search-screen.tsx`, `search-results.tsx`, `search-row.tsx` | Interfaz (RF-2, RF-6 a RF-9, RF-12) |
| `src/components/calendar/calendar-heading.tsx`, `src/components/shell/top-nav.tsx` | Botón "Buscar" (RF-1) |
| `src/lib/calendar/shortcuts.ts`, `use-calendar-shortcuts.ts` | Tecla `/` |
| `src/lib/offline/offline-sources.ts`, `src/components/offline/offline-router.tsx` | Búsqueda en la copia (RF-10) |
| `src/lib/offline/gates.ts` | La ruta de búsqueda ya no `needsNetwork` |

## Modelo de datos

- `create extension if not exists pg_trgm with schema extensions; create extension if not exists unaccent with schema extensions;`
- `public.search_text(t text) returns text immutable` que envuelve `extensions.unaccent('extensions.unaccent', t)` (forma inmutable para indexar).
- `create index events_search_idx on events using gin (public.search_text(coalesce(title,'') || ' ' || coalesce(location,'') || ' ' || coalesce(description,'')) extensions.gin_trgm_ops);`
- `create index event_comments_search_idx on event_comments using gin (public.search_text(body) extensions.gin_trgm_ops);`
- `search_events` devuelve `(event_id uuid, matched_comment text)`; la app lee después las filas con la consulta de siempre (RLS) para no duplicar columnas.

## Decisiones

- D1: Trigramas con `ILIKE` sobre el texto normalizado y no `tsvector`: `tsvector` en español trocea por raíces ("dentista" → "dent") y no encuentra prefijos cortos ni nombres propios; los trigramas cubren prefijos y subcadenas, que es lo que se espera en una caja de búsqueda. Cada palabra de la consulta debe aparecer (AND).
- D2: Ruta propia y no un diálogo: se puede recargar, compartir y volver atrás; en el móvil ocupa la pantalla, que es lo natural.
- D3: Ignorar la visibilidad de los filtros (RF-4): buscar es precisamente encontrar lo que no se ve.
- D4: Periodo de series acotado (−1 año, +2 años, ampliable): sin acotar, una serie diaria sin fin no termina.
- D5: Últimas búsquedas solo en el dispositivo (`localStorage` `cafam-recent-search`): privado y sin tabla.

## Pasos de producción (los ejecuta el usuario)

```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```

Las dos extensiones están disponibles en Supabase Free; la migración las crea en el esquema `extensions`.

## Riesgos

- `unaccent` no es inmutable: por eso la función envoltorio con el diccionario explícito.
- Crear los índices en prod con pocos miles de filas tarda segundos.
