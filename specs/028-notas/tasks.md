# Tasks 028 — Notas

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **cerrada** (2026-11-15). Pendiente del usuario: aplicar las dos migraciones a dev y a prod.

## Tareas

- [x] T1 Esquema, RLS y funciones
  Evidencia (2026-11-15): `20261115100000_notes.sql` y `20261115110000_notes_calendar_functions.sql` (esta, generada a partir del cuerpo vigente de `merge_calendars` y `copy_calendar_for_owner`). Aplicadas en el Supabase local; `list_tables_without_rls()` vacío; tipos regenerados con `supabase gen types typescript --local`. `tests/integration/notes.test.ts`, 15 casos: nota personal solo de su autor (ni miembros de sus calendarios ni anónimos), `owner_id` no escribible, título recortado y tipo inmutable, orden y `done_at` de la base de datos, elementos solo en listas y `CF429 items` al 201.º, `CF429 notes` a la 501.ª, compartida leída por miembros y escrita solo por Propietario y Editores, no se crea donde no se puede escribir, borrado por autor o Propietario, solo el autor la hace personal, al salir del calendario queda sin autor, borrar la cuenta borra las personales y deja las compartidas, borrar el calendario borra sus notas, juntar las mueve y la copia las lleva. Un caso falló en la primera pasada por el propio test (un `insert` múltiple sin `done` en una fila), corregido. Cubre: RF-13, RF-14

- [x] T2 Lógica pura
  Evidencia (2026-11-15): `lib/notes/` y `tests/unit/notes-lib.test.ts` (16 casos). Cubre: RF-2, RF-6, RF-10, RF-13

- [x] T3 Lecturas y acciones
  Evidencia (2026-11-15): `app/dashboard/notes/actions.ts` y `notes-actions.test.ts` (11 casos: id propio al crear, devolver lo escrito si falla, solo lo que cambia, 0 filas = "ya no existe o no tienes permiso", validar antes de escribir, conexión perdida, límites traducidos, un cambio por escritura y sin revalidar en los elementos). Cubre: RF-4 a RF-9, RF-11

- [x] T4 Lista de notas y alta
  Evidencia (2026-11-15): `NotesBoard`, `NoteCard`, `NoteForm` y las páginas `/dashboard/notes` y `/new`. En `notes-ui.test.tsx`: orden con fijadas primero y sin archivadas, vistazo al contenido, búsqueda sin tildes, filtros, estados vacíos con Venito, formulario. Cubre: RF-1 a RF-4

- [x] T5 Editor de una nota
  Evidencia (2026-11-15): `NoteEditor`, `Checklist`, `TextNote` y `/dashboard/notes/[id]`. En `notes-ui.test.tsx` (18 casos en total): añadir con Intro manteniendo el foco y con id propio, marcar y bajar, revertir y avisar si falla, mover con botones que paran en los extremos, renombrar al salir del campo, borrar y "Deshacer", borrar completados, título, fijar/archivar/color/compartir, confirmación al borrar la nota, solo lectura para un Lector con su motivo, adoptar lo que manda el servidor y guardado automático del texto. Cubre: RF-5 a RF-10, RF-12

- [x] T6 Privacidad, capturas, recorrido y cierre
  Evidencia (2026-11-15): sección "Notas" en `/privacy` con su test. Recorrido en el iPhone emulado (`.scratch/notes-e2e.mjs`, no versionado): Notas desde la barra inferior, estado vacío, nueva lista "Compra de la semana", tres elementos con Intro, marcar "Leche", borrar "Huevos" y "Deshacer", fijar y color; en la base de datos queda `pinned: true`, `#CAFFBF` y los tres elementos con sus posiciones y "Leche" hecha; un cambio hecho desde fuera (marcar "Pan") aparece en 795 ms; la búsqueda "huev" encuentra la nota. 9 capturas en `specs/028-notas/capturas/` (390 px claro y oscuro, 1440 px claro). P8: typecheck sin errores, lint 0 errores y 1 aviso previo, format:check limpio, `npm test` 288 archivos y 2.773 tests, build correcto, `npm run test:db -- --no-file-parallelism` 49 archivos y 552 tests contra el Supabase local. Cubre: RF-15, CA-1, CA-3, CA-4

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 a RF-4 | T2, T4 |
| RF-5 a RF-10 | T2, T3, T5 |
| RF-11 | T3 |
| RF-12 | T1, T5 |
| RF-13, RF-14 | T1 |
| RF-15 | T6 |
