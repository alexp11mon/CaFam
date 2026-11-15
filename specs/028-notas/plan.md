# Plan 028 — Notas

Spec: `specs/028-notas/spec.md`. Aprobado de antemano (2026-11-15).

## Modelo de datos (migraciones nuevas)

`20261115100000_notes.sql`

- `notes (id, owner_id → profiles on delete set null default auth.uid(), calendar_id → calendars on delete cascade, kind 'list'|'text', title ≤ 100, body ≤ 10000, color, pinned, archived, due_date, created_at, updated_at)`, con `check (owner_id is not null or calendar_id is not null)`.
- `note_items (id, note_id → notes on delete cascade, text 1..300, done, done_at, position, created_at)`.
- RLS en las dos. Leer: nota personal, su autor; compartida, los miembros del calendario. Escribir: personal, su autor; compartida, rol `owner` o `editor`. Borrar una compartida: el Propietario del calendario, o su autor si aún es Editor. Los elementos heredan el permiso de su nota (`can_read_note`, `can_write_note`, `SECURITY DEFINER` con `search_path = ''`).
- Permisos por columna: el cliente nunca escribe `owner_id`, `created_at`, `updated_at` ni `done_at`.
- Triggers: `notes_rules` (recorta el título, tipo inmutable, solo el autor o el Propietario de los dos calendarios cambia el vínculo, `CF429 notes` a las 500, `updated_at`), `note_items_rules` (recorta, solo en listas, `CF429 items` a los 200, `done_at`), `note_items_touch` (un cambio en un elemento actualiza la nota), `live_notes_changed` (`live_notify` al calendario y al autor), `notes_member_left` (al salir de un calendario, sus notas de allí quedan sin autor) y `notes_profile_deleted` (borra las personales antes de borrar el perfil).
- Índices: `notes (owner_id, archived, pinned, updated_at desc)`, `notes (calendar_id)`, `note_items (note_id, position)`.

`20261115110000_notes_calendar_functions.sql`

- `merge_calendars` y `copy_calendar_for_owner`, redefinidas con su cuerpo actual más las notas (mover y copiar).

## Módulos

| Módulo | Responsabilidad |
|--------|-----------------|
| `src/lib/notes/` | `limits.ts`, `schemas.ts` (zod en español), `error-messages.ts`, `order.ts` (orden de tarjetas y de elementos, mover), `search.ts` (normalizar y filtrar), `progress.ts`, `permissions.ts` (qué ofrece la interfaz según rol; la base de datos lo impone), `queries.ts` (lecturas con RLS) |
| `src/app/dashboard/notes/` | `page.tsx` (lista), `new/page.tsx`, `[id]/page.tsx`, `actions.ts` (crear, cambiar, borrar nota; añadir, cambiar, mover, borrar y restaurar elementos) |
| `src/components/notes/` | `notes-board.tsx` (buscador, chips, tarjetas), `note-card.tsx`, `note-form.tsx` (alta), `note-editor.tsx` (cabecera y acciones), `checklist.tsx`, `text-note.tsx` |
| `src/app/privacy/page.tsx` | Sección "Notas" |

## Decisiones

- **D1 Notas compartidas por calendario, con sus mismos roles.** Reutiliza el modelo de permisos que el usuario ya conoce (Lector, Editor, Propietario) y sus funciones (`is_calendar_member`, `calendar_role_for`). Alternativa descartada: compartir cada nota con personas sueltas (tabla y pantallas nuevas de miembros).
- **D2 Una nota compartida pertenece al calendario.** Si su autor se va, se queda sin autor, como un evento. `owner_id` solo decide quién ve una nota personal y quién puede borrar o mover una compartida.
- **D3 Fijar y archivar son de la nota, no de cada persona.** En una compartida lo ven todos. Preferencias por persona exigirían otra tabla; se puede añadir después.
- **D4 Los ids los crea el navegador** (`crypto.randomUUID()`), así un elemento recién añadido ya tiene su id definitivo y se puede marcar o borrar sin esperar al servidor.
- **D5 El estado de la nota abierta vive en el navegador y el servidor confirma.** Cada acción escribe una sola cosa; si falla, se revierte ese cambio y se avisa. Las props nuevas del servidor (tiempo real) sustituyen el estado cuando no hay nada pendiente ni un campo con el foco.
- **D6 Reordenar con botones, no arrastrando.** Arrastrar dentro de una lista que también se desplaza con el dedo exige mantener pulsado y un asa, y aun así choca con el desplazamiento en iOS; los botones "Subir" y "Bajar" son accesibles, de 44 px y no fallan. Se anota el arrastre como mejora futura.
- **D7 El orden se guarda como posiciones enteras reescritas** (0, 1, 2…) con una sola llamada `upsert` de las filas movidas: con 200 elementos como mucho no hace falta un esquema de posiciones fraccionarias.
- **D8 Borrar un elemento es definitivo en el servidor; "Deshacer" lo vuelve a insertar** con su mismo id, texto, estado y posición. Sin papelera.
- **D9 Fecha límite por nota**, no por elemento (ver "Fuera de alcance").
- **D10 `merge_calendars` y `copy_calendar_for_owner` se redefinen** en una migración nueva copiando su cuerpo vigente y añadiendo las notas: es la única forma de que mover y copiar sean atómicos con el resto.
- **D11 Tiempo real con el canal que ya existe**: `live_notify(calendar_id, owner_id)`. Ningún canal nuevo (coste cero).

## Riesgos

- R1 Redefinir dos funciones largas: se generan a partir del texto de la migración vigente y los tests existentes (`merge-calendars`, `account-orphans`) deben seguir en verde.
- R2 `on delete set null` en `owner_id` chocaría con el `check` de las notas personales: el trigger `notes_profile_deleted` las borra antes.

## Verificación

P8 con `test:db`; capturas; recorrido en el móvil.
