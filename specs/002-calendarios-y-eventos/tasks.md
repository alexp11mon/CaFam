# Tasks 002 - Calendarios y eventos

> Estado: **Borrador pendiente de aprobación**.
> Spec: `specs/002-calendarios-y-eventos/spec.md`. Plan: `specs/002-calendarios-y-eventos/plan.md`.
> Reglas: una tarea cada vez, test primero, y al cerrar cada tarea se ejecuta y reporta el checklist de "Verificación obligatoria" de la constitución (P7, P8): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` si toca esquema, RLS o acceso a datos, y prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Antes de escribir la primera página nueva (T6), leer la guía correspondiente de `node_modules/next/dist/docs/` (plan R2). Un commit por tarea citándola, en la rama `002-calendarios-y-eventos`.

## Tareas

- [x] T1 Crear la migración de categorías, preferencias, columnas de evento, límites y `visible_people` con sus tests de base de datos
  Pasos: test primero en `tests/integration/calendars-events.test.ts`:
  - categorías: miembro lee, lector no escribe, owner y editor sí, ajeno no ve nada; nombre duplicado ignorando mayúsculas y espacios falla con `23505`; borrar una categoría deja el evento con `category_id` nulo;
  - eventos: una categoría de otro calendario falla; mover un evento a otro calendario con categoría la deja nula; mover exige ser owner/editor en origen y destino; un lector no mueve ni crea;
  - límites: título de 101, descripción de 2001, lugar de 201 y nombre de calendario de 51 caracteres fallan;
  - preferencias: cada usuario solo ve y escribe las suyas y solo de calendarios de los que es miembro; `anon` no ve nada;
  - `visible_people()`: devuelve solo `id` y `display_name` de uno mismo y de los propietarios de calendarios de los que es miembro (membresías insertadas con la clave secreta, solo en `tests/`).
  Migración `supabase/migrations/<timestamp>_calendars_and_events.sql` según "Modelo de datos" del plan (tablas `event_categories`, `calendar_preferences`, `person_preferences`; `events.color` y `events.category_id` con FK compuesta; trigger `events_reset_category`; `updated_at`; RLS; `visible_people`). Antes del `db push`, comprobar en dev que ningún dato existente rompe los nuevos límites (R5). Después `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- calendars-events` y `npm run test:db -- schema rls` en verde (la comprobación de RLS de todas las tablas de `public` incluida) y `src/types/database.ts` contiene `event_categories`, `calendar_preferences` y `person_preferences`. Cubre: RF-4, RF-8, RF-10, RF-11, RF-12, RF-13, RF-14, RF-16, RF-19, RF-25, RF-27, RF-28, RF-42, RF-46, RF-48 | Módulo: SQL (migración, RLS, `visible_people`)

- [x] T2 Crear la función `merge_calendars` con sus tests de base de datos
  Pasos: test primero en `tests/integration/merge-calendars.test.ts`: dos calendarios con eventos y categorías se juntan en uno existente conservando su nombre, color y descripción; juntar en uno nuevo con nombre y color; las categorías con el mismo nombre (ignorando mayúsculas y espacios) se unifican y sus eventos pasan a la del destino; las demás categorías se mueven; los calendarios origen desaparecen con sus preferencias; menos de dos calendarios falla; un destino que no está entre los origen falla; si uno de los calendarios no es del usuario, falla con `42501` sin cambiar nada; un fallo forzado a mitad (p. ej. un identificador inexistente al final de la lista) deja todo intacto; el destino conserva sus miembros y los de los origen desaparecen (RF-55). Migración `<timestamp>_merge_calendars.sql` según "Funciones y triggers" del plan (`security invoker`, FK de categoría diferida dentro de la función); `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- merge-calendars` en verde con todos los casos y `npm run test:db -- calendars-events` sigue en verde. Cubre: RF-49, RF-50, RF-51, RF-53, RF-54, RF-55 | Módulo: SQL (`merge_calendars`)

- [x] T3 Implementar paleta, zonas horarias y rangos de vista como lógica pura
  Pasos: tests primero en `tests/unit/palette.test.ts` (≥ 12 colores únicos, incluye `#2563EB`, `readableTextColor` da ≥ 4,5:1 para cada color de la paleta), `tests/unit/time-zone.test.ts` (ida y vuelta local↔UTC en Europe/Madrid y America/New_York, días de cambio de hora, hora inexistente → la siguiente válida y hora ambigua → la primera, medianoche, día completo como fecha UTC) y `tests/unit/ranges.test.ts` (semana desde lunes, rejilla de mes con semanas completas, rango de semana y de día, anterior/siguiente/hoy, parseo de `?view=&date=` con valores inválidos → mes actual); módulos `src/lib/calendar/palette.ts`, `time-zone.ts`, `ranges.ts` (solo `Intl`, sin dependencias, D2).
  Hecho cuando: `npm test -- palette time-zone ranges` en verde y `package.json` sin dependencias nuevas. Cubre: RF-2, RF-17, RF-20, RF-29, RF-30, RF-34 | Módulo: palette, time-zone, ranges

- [x] T4 Implementar la disposición de eventos y la agrupación por persona como lógica pura
  Pasos: tests primero en `tests/unit/layout.test.ts` (evento que cruza medianoche aparece en ambos días, varios días aparece en cada día, día completo/varios días separado de los que tienen hora, solape en cadena y bordes iguales sin taparse, duración cero, "+N más" cuando no caben) y `tests/unit/grouping.test.ts` (yo primero, orden manual de personas y de calendarios, sin posición → al final por fecha de creación, sin preferencia → visible, calendario nuevo al final de su propietario); módulos `src/lib/calendar/layout.ts` y `src/lib/calendar/grouping.ts`.
  Hecho cuando: `npm test -- layout grouping` en verde. Cubre: RF-20, RF-21, RF-35, RF-39, RF-40, RF-42, RF-45, RF-47 | Módulo: layout, grouping

- [x] T5 Implementar los esquemas de validación, el estado genérico de formularios y la traducción de errores
  Pasos: tests primero en `tests/unit/calendar-schemas.test.ts` (calendario: nombre 0/1/50/51 y solo espacios, descripción 500/501, color fuera de paleta; categoría 0/1/40/41; evento: título 0/1/100/101, descripción 2000/2001, lugar 200/201, fin < inicio, inicio = fin permitido, día completo solo con fechas y fin inclusivo → exclusivo, color vacío = el del calendario; juntar: ≥ 2 origen, destino entre ellos o nombre nuevo) y `tests/unit/calendar-error-messages.test.ts` (23505, 42501, FK, calendario inexistente, desconocido → "No se ha podido conectar…"); módulos `src/lib/calendar/schemas.ts`, `src/lib/calendar/error-messages.ts` y `src/lib/forms/form-state.ts` (sin tocar el de auth).
  Hecho cuando: `npm test -- calendar-schemas calendar-error-messages` en verde. Cubre: RF-1, RF-4, RF-9, RF-15, RF-16, RF-18, RF-19, RF-20, RF-21 | Módulo: schemas, error-messages

- [ ] T6 Implementar el CRUD de calendarios y el panel actualizado
  Pasos: tests primero en `tests/unit/calendar-form.test.tsx` (errores junto al campo, color con `radiogroup` navegable por teclado, botón deshabilitado mientras está pendiente, valores conservados tras error), `tests/unit/confirm-dialog.test.tsx` (texto con el nombre y el aviso de que se perderán los eventos, cancelar no envía, confirmar envía) y ampliar `tests/unit/calendar-list.test.tsx` (estado vacío con "Crear calendario", accesos "Editar" solo si Propietario y "Categorías" si Propietario o Editor, orden recibido respetado); `src/lib/calendar/queries.ts` (`getMyCalendars`, `getProfileTimeZone`), Server Actions `createCalendar`, `updateCalendar`, `deleteCalendar` en `src/app/dashboard/calendars/actions.ts`, páginas `/dashboard/calendars/new` y `/dashboard/calendars/[id]/edit` (404 si no es Propietario), componentes `color-picker`, `calendar-form`, `confirm-dialog`, y panel `/dashboard` con accesos a "Abrir calendario", "Nuevo calendario" y "Juntar".
  Hecho cuando: `npm test -- calendar-form confirm-dialog calendar-list` en verde y demo manual en móvil y escritorio: crear, editar color/nombre y borrar un calendario con confirmación, y borrar todos muestra el estado vacío con "Crear calendario". Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-6, RF-7, RF-8, RF-41 | Módulo: calendars/actions, calendar-form, color-picker, confirm-dialog, calendar-list, queries

- [ ] T7 Implementar la gestión de categorías por calendario
  Pasos: tests primero en `tests/unit/category-manager.test.tsx` (lista de categorías, crear, renombrar, borrar con confirmación, error "Ya existe una categoría con ese nombre." junto al campo, sin controles de edición para el Lector); Server Actions `createCategory`, `renameCategory`, `deleteCategory` en `src/app/dashboard/calendars/[id]/categories/actions.ts`, componente `category-manager` y página `/dashboard/calendars/[id]/categories` (404 para el Lector); añadir `getCategories` a `queries.ts`.
  Hecho cuando: `npm test -- category-manager` en verde y demo manual: crear "Clases de la UNI", intentar duplicarla con otras mayúsculas (rechazada), renombrarla y borrarla. Cubre: RF-9, RF-10, RF-11, RF-12, RF-13, RF-14 | Módulo: categories/actions, category-manager

- [ ] T8 Implementar el alta, edición, detalle y borrado de eventos
  Pasos: tests primero en `tests/unit/event-form.test.tsx` (campos del plan; alternar día completo oculta las horas; categorías filtradas por el calendario elegido; solo se ofrecen calendarios donde se puede escribir; errores de título y de fin junto al campo; color vacío = el del calendario) y `tests/unit/event-detail.test.tsx` (título, fechas en la zona del perfil, descripción, lugar, categoría y calendario; Lector sin botones de crear, editar ni borrar; borrar pide confirmación); Server Actions `createEvent`, `updateEvent`, `deleteEvent` en `src/app/dashboard/events/actions.ts` (conversión local→UTC con `time-zone.ts`, día completo con fin exclusivo), componente `event-form`, páginas `/dashboard/events/new` (precarga `?calendar=&date=`) y `/dashboard/events/[id]`, y `getEventById` en `queries.ts`.
  Hecho cuando: `npm test -- event-form event-detail` en verde y demo manual: crear un evento con hora, uno de día completo y uno de varios días con categoría y color propio, editarlos, cambiar uno de calendario (pierde la categoría) y borrar uno con confirmación. Cubre: RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-26, RF-27, RF-36 | Módulo: events/actions, event-form, event-detail

- [ ] T9 Implementar las vistas mensual, semanal y diaria con su barra de herramientas
  Pasos: tests primero en `tests/unit/month-view.test.tsx` (celdas del mes con semana desde lunes, color por calendario o por evento, "+N más" que enlaza a la vista diaria, pulsar un día abre `?view=day&date=`, "No hay eventos" sin eventos), `tests/unit/week-view.test.tsx` y `tests/unit/day-view.test.tsx` (franja de día completo separada, hora en la zona del perfil, eventos solapados uno junto a otro, "No hay eventos") y `tests/unit/view-toolbar.test.tsx` (cambiar de vista, anterior, siguiente y "Hoy" generan las URL esperadas); componentes `month-view`, `week-view`, `day-view`, `view-toolbar`, `event-chip`; `getEventsInRange` en `queries.ts`; página `/dashboard/calendar` (mes actual por defecto, lectura de `searchParams` dentro de `<Suspense>`) mostrando los eventos de todos los calendarios; en 360 px la semana permite llegar a todos los días sin scroll horizontal de la página.
  Hecho cuando: `npm test -- month-view week-view day-view view-toolbar` en verde y demo manual en móvil (360 px) y escritorio navegando mes → día → semana con eventos de los tres tipos, atrás/adelante del navegador y sin scroll horizontal de página. Cubre: RF-17, RF-29, RF-30, RF-31, RF-34, RF-35, RF-37, RF-38, RF-39, RF-40 | Módulo: month-view, week-view, day-view, view-toolbar, event-chip, queries

- [ ] T10 Implementar el panel de filtros por persona con visibilidad y orden guardados
  Pasos: tests primero en `tests/unit/calendar-filters.test.tsx` (árbol personas → calendarios → categorías; casilla de un calendario oculta sus eventos y la de una persona alterna todos los suyos; subir/bajar cambia el orden y el foco se mantiene; si la acción falla se revierte y se muestra el error; sin otras personas solo aparece la propia), `tests/unit/preferences-actions.test.ts` (carga de datos mockeando `@supabase/supabase-js`: `upsert` de filas propias para visibilidad y orden) y `tests/integration/preferences.test.ts` (visibilidad y orden se guardan y se recuperan en otra sesión del mismo usuario; otro usuario no los ve); Server Actions `setCalendarVisibility`, `setPersonVisibility`, `saveOrder` en `src/app/dashboard/calendar/preferences-actions.ts`, componente `calendar-filters` (plegable en móvil), carga de personas y preferencias en `queries.ts` e integración en `/dashboard/calendar` y en el orden del panel.
  Hecho cuando: `npm test -- calendar-filters preferences-actions` y `npm run test:db -- preferences` en verde y demo manual: ocultar un calendario y una categoría, reordenar, recargar y entrar desde otro navegador conservando visibilidad y orden. Cubre: RF-32, RF-33, RF-42, RF-43, RF-44, RF-45, RF-46, RF-47, RF-48 | Módulo: calendar-filters, preferences-actions, queries

- [ ] T11 Implementar la interfaz y la acción de juntar calendarios
  Pasos: tests primero en `tests/unit/merge-form.test.tsx` (solo lista calendarios propios; exige ≥ 2; elegir uno existente como resultado o uno nuevo con nombre y color; la confirmación muestra los calendarios afectados, cuáles desaparecen, el número de eventos que se mueven y el aviso de que no se puede deshacer; error de permisos en español) y `tests/unit/merge-action.test.ts` (llamada a `rpc('merge_calendars')` con los argumentos del formulario y traducción de errores); Server Action `mergeCalendars`, componente `merge-form`, página `/dashboard/calendars/merge` y consulta de recuento de eventos.
  Hecho cuando: `npm test -- merge-form merge-action` en verde y demo manual: juntar "Clases Uni" y "Examenes Uni" en "Universidad" (nuevo y existente) comprobando que eventos y categorías pasan al resultado y los otros desaparecen del panel. Cubre: RF-49, RF-50, RF-51, RF-52, RF-53, RF-54 | Módulo: merge-form, calendars/actions

- [ ] T12 Validar la spec en producción, cobertura RF por RF y fuera de alcance
  Pasos: comprobar que `public/sw.js` no cachea rutas de datos ni de `/dashboard` (test `tests/unit/sw-no-data.test.ts`), el test de 500 eventos en el mes (`tests/integration/range-performance.test.ts`, consulta de rango < 3 s), checklist de la tabla de trazabilidad RF → tarea → test con evidencia en este archivo, comprobar que no hay nada de "Fuera de alcance" (sin recurrencia, arrastrar y soltar, búsqueda, papelera ni dependencias nuevas en `package.json`), actualizar `AGENTS.md` (estado, rutas, esquema, estructura) y preparar al usuario los comandos para aplicar las migraciones a prod y volver a enlazar dev (los ejecuta él, con `!`).
  Hecho cuando: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:db && npm run build` en verde con la salida reportada, migraciones aplicadas por el usuario en prod, demo manual en producción en móvil y escritorio del flujo crear calendario → categoría → eventos (con hora, día completo y varios días) → vistas → filtros → editar → juntar → borrar, y aprobación explícita del usuario para cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T5, T6
- RF-2 -> T3, T6
- RF-3 -> T6
- RF-4 -> T1, T5, T6
- RF-5 -> T6
- RF-6 -> T6
- RF-7 -> T6
- RF-8 -> T1, T6
- RF-9 -> T5, T7
- RF-10 -> T1, T7
- RF-11 -> T1, T7
- RF-12 -> T1, T7
- RF-13 -> T1, T7
- RF-14 -> T1, T7
- RF-15 -> T5, T8
- RF-16 -> T1, T5, T8
- RF-17 -> T3, T8, T9
- RF-18 -> T5, T8
- RF-19 -> T1, T5, T8
- RF-20 -> T3, T4, T5, T8
- RF-21 -> T4, T5, T8
- RF-22 -> T8
- RF-23 -> T8
- RF-24 -> T8
- RF-25 -> T1
- RF-26 -> T8
- RF-27 -> T1, T8
- RF-28 -> T1
- RF-29 -> T3, T9
- RF-30 -> T3, T9
- RF-31 -> T9
- RF-32 -> T10
- RF-33 -> T10
- RF-34 -> T3, T9
- RF-35 -> T4, T9
- RF-36 -> T8
- RF-37 -> T9
- RF-38 -> T9
- RF-39 -> T4, T9
- RF-40 -> T4, T9
- RF-41 -> T6
- RF-42 -> T1, T4, T10
- RF-43 -> T10
- RF-44 -> T10
- RF-45 -> T4, T10
- RF-46 -> T1, T10
- RF-47 -> T4, T10
- RF-48 -> T1, T10
- RF-49 -> T2, T11
- RF-50 -> T2, T11
- RF-51 -> T2, T11
- RF-52 -> T11
- RF-53 -> T2, T11
- RF-54 -> T2, T11
- RF-55 -> T2
- RNF (rendimiento, PWA, contraste, mobile-first, fuera de alcance) -> T3, T9, T12

## Dudas abiertas

- [NECESITA ACLARACIÓN] RF-55 (heredada de la spec y el plan): con compartición real (spec 003), juntar calendarios con miembros distintos descartaría a los miembros de los origen. En esta spec solo hay un miembro por calendario; T2 deja el comportamiento cubierto con tests y se revisará en la 003.
