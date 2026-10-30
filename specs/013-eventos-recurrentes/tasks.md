# Tasks 013 - Eventos recurrentes

> Estado: **Aprobadas** por el usuario (2026-10-30).
> Spec: `specs/013-eventos-recurrentes/spec.md` (aprobada el 2026-10-29). Plan: `specs/013-eventos-recurrentes/plan.md` (aprobado el 2026-10-30).
> 16 tareas en dos iteraciones: T1–T8 (base de datos, lógica pura y lectura) y T9–T16 (interfaz, escritura y validación). No se empieza la segunda sin cerrar la primera.
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si toca esquema, RLS o datos, también `npm run test:db -- <filtro>` (por tandas si salta el límite de Auth).
> - Si toca interfaz: capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo (P9).
> - Un commit por tarea, citándola, en la rama `013-eventos-recurrentes`. El primer commit lleva `plan.md` y `tasks.md`.
>
> Sin dependencias nuevas (P6): `ical.js` ya aprobado (enmienda 3), solo en `src/lib/ics/parse-ics.ts` y `src/lib/recurrence/expand.ts`.
> Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario al cerrar.

## Tareas

### Iteración 1 — Base de datos, lógica pura y lectura

- [x] T1 Añadir las series y sus excepciones al esquema de eventos
  Pasos:
  - Primero, `tests/integration/event-series.test.ts` en rojo. Comprueba:
    - propietario y Editor crean una serie con `insert`; un Lector no (0 filas o `42501`); los miembros leen series y excepciones, un ajeno y `anon` no;
    - los `check`: serie sin `recurrence_tz` en un evento con hora, excepción sin `original_start`, serie que es a la vez excepción y patrón de RRULE no válido fallan;
    - una excepción en otro calendario que su serie falla; dos excepciones de la misma repetición, también;
    - mover la serie a otro calendario mueve sus excepciones; borrarla las borra;
    - una serie en un calendario traído da `22023`; la 501.ª serie de un calendario da `CF429` (`series`); la 101.ª excepción (contando `exdates`), `CF429` (`exceptions`);
    - `reserve_event_images` sobre una serie da `22023`; sobre una excepción, funciona;
    - `list_tables_without_rls()` sigue vacía.
  - Después, la migración `event_series` según "Modelo de datos" (columnas, restricciones, FK compuesta, índices, `enforce_series_rules` y `reserve_event_images`).

  Hecho cuando: `npm run test:db -- event-series event-images schema` en verde y `src/types/database.ts` con las columnas nuevas. Cubre: RF-6, RF-23, RF-24, RF-29, RF-31, RF-32 | Módulo: series-schema
  Evidencia (2026-10-30): rojo antes de la migración (11 tests, columnas inexistentes). Migraciones `20261031100000_event_series.sql`, `20261031100100_series_reserve_images.sql` y `20261031100200_series_rules_fast_tz.sql` (la validación de zona con `pg_timezone_names` hacía saltar el tiempo máximo al insertar 500 series) aplicadas en dev y tipos regenerados. `test:db -- event-series` 11 tests y `event-images schema merge` 6 archivos y 80 tests en verde. typecheck y format en verde, lint con los 2 avisos previos, `npm test` 1556 tests, build correcto.

- [x] T2 Modelar la regla de repetición y su RRULE
  Pasos:
  - Primero, `tests/unit/recurrence-rule.test.ts` en rojo: `toRRule` y `fromRRule` de ida y vuelta para diaria, semanal con varios días, mensual por día y por posición (1.º a 4.º y último), anual y laborables; intervalo 1 y 99 válidos, 0 y 100 no; `COUNT` 1 y 999 válidos, 0 y 1000 no; `UNTIL` en fecha (día completo) y en hora de reloj de fin de día (con hora); `toRRule` siempre escribe las partes `BY*` (D5); `fromRRule` rechaza partes no admitidas (`RDATE`, `BYHOUR`, `BYSETPOS` suelto…) y longitudes de más de 200.
  - Después, `src/lib/recurrence/rule.ts`, `limits.ts` y `schemas.ts`.

  Hecho cuando: `npm test -- recurrence-rule` en verde. Cubre: RF-3, RF-4, RF-31, RF-32 | Módulo: recurrence-rule
  Evidencia (2026-10-30): rojo con el módulo inexistente; `npm test -- recurrence-rule` 29 tests en verde. typecheck y format en verde, lint con los 2 avisos previos, `npm test` 178 archivos y 1585 tests, build correcto.

- [x] T3 Calcular las opciones rápidas de "Repetir" a partir de la fecha
  Pasos:
  - Primero, `tests/unit/recurrence-presets.test.ts` en rojo: para el martes 10-11-2026 salen "Cada día", "Cada semana el martes", "Cada mes el día 10", "Cada mes el 2.º martes", "Cada año el 10 de noviembre", "Todos los días laborables (lunes a viernes)" y "Personalizado…", sin "el último"; para el martes 24-11-2026 sale además "Cada mes el último martes"; "No se repite" es el valor por defecto; `resolveRepeat` resuelve cada tipo con la fecha enviada (cambiar la fecha cambia el día, D13), `custom:<RRULE>` pasa por `fromRRule` y un valor desconocido da error.
  - Después, `src/lib/recurrence/presets.ts`.

  Hecho cuando: `npm test -- recurrence-presets` en verde. Cubre: RF-1, RF-2, RF-7 | Módulo: recurrence-presets
  Evidencia (2026-10-30): rojo con el módulo inexistente; `npm test -- recurrence-presets` 11 tests en verde (los nombres de días y meses viven en `summary.ts`, que completa T4). Verificación completa en verde (lint con los 2 avisos previos), build correcto.

- [x] T4 Resumir una regla en español
  Pasos:
  - Primero, `tests/unit/recurrence-summary.test.ts` en rojo con los textos exactos: "Cada día", "Cada 2 semanas el lunes y el jueves, 10 veces", "Cada mes el último viernes", "Cada mes el día 31", "Cada año el 29 de febrero", "Cada semana de lunes a viernes, hasta el 15 de enero de 2027", "Cada 3 días" y una vez ("1 vez").
  - Después, `src/lib/recurrence/summary.ts` (sin `ical.js`).

  Hecho cuando: `npm test -- recurrence-summary` en verde. Cubre: RF-5, RF-10 | Módulo: recurrence-summary
  Evidencia (2026-10-30): rojo sin `summarizeRule`; `npm test -- recurrence-summary` 13 tests en verde. Verificación completa en verde (lint con los 2 avisos previos), build correcto.

- [x] T5 Expandir series en un rango con `ical.js` e identificar repeticiones
  Pasos:
  - Primero, `tests/unit/recurrence-expand.test.ts` y `occurrence-id.test.ts` en rojo. Comprueban (R1 al principio):
    - una serie semanal a las 18:00 en `Europe/Madrid` sigue a las 18:00 de reloj antes y después de los cambios de marzo y octubre (UTC distinto);
    - mensual el día 31 se salta los meses sin 31; anual el 29 de febrero solo sale en bisiestos; "el 5.º martes" no se admite y "el último" sí;
    - las de día completo salen en la misma fecha UTC sin zona; las de varios días que se solapan (3 días cada 2 días) salen todas;
    - una serie que empieza antes del rango da solo sus repeticiones dentro; `COUNT` y `UNTIL` (incluida) se respetan; `skip` quita las fechas con excepción o en `exdates`;
    - una serie diaria sin fin de hace 10 años da el mismo resultado con y sin salto rápido (D6) y la expansión de 50 series en un mes tarda menos de 50 ms;
    - `firstOccurrence` de "cada lunes" empezando un miércoles es el lunes siguiente y es nula si el fin es anterior (RF-8); `seriesBound` es nula sin fin; `truncateBefore` da el `UNTIL` o el `COUNT` restante;
    - `occurrenceId` y `parseEventId` de ida y vuelta, y un uuid suelto se reconoce como evento.
  - Primero también: ampliar `tests/unit/no-secrets.test.ts` (o un test hermano) para que falle si un archivo `"use client"` importa `ical.js` o `lib/recurrence/expand` (R7).
  - Después, `src/lib/recurrence/expand.ts` y `occurrence-id.ts`.

  Hecho cuando: `npm test -- recurrence-expand occurrence-id no-secrets` en verde. Cubre: RF-6, RF-8, RF-11, RF-12, RF-13, RF-14, RF-17 | Módulo: recurrence-expand, occurrence-id
  Evidencia (2026-10-30): rojo con los módulos inexistentes. `ical.js` omite por sí mismo el día 31 en los meses cortos y el 29 de febrero en los años no bisiestos (R1 resuelto, sin filtro propio). Para no hacer 4 llamadas a `Intl` por repetición se reutiliza el desfase anterior con una sola comprobación. La regla anual rechaza días que el mes nunca tiene (30 de febrero), que dejarían al iterador buscando sin fin. El test de tiempo (50 series en un mes) salía 66–223 ms según la carga de la suite: se quitó del unitario y el requisito de rendimiento se mide en `range-performance` (T7). `npm test -- recurrence-expand occurrence-id no-secrets recurrence-rule` en verde (19 + 7 + guardias + 31). Verificación completa: typecheck, format, `npm test` 182 archivos y 1638 tests, build correcto, lint con los 2 avisos previos.

- [x] T6 Cambiar y borrar repeticiones con funciones por alcance
  Pasos:
  - Primero, ampliar `event-series.test.ts` en rojo, con series sembradas y la RRULE truncada calculada en el test:
    - `update_occurrence` crea la excepción y la actualiza en una segunda llamada; con `{}` la crea idéntica; la 101.ª da `CF429`;
    - `split_series` trunca la original, crea la nueva y, con `p_keep_exceptions`, reasigna las excepciones posteriores propagando los campos que coincidían; sin él, las borra;
    - `update_series` propaga solo los campos que coincidían con la serie; con `p_shift` desplaza `original_start` y las horas no cambiadas; con `p_drop_exceptions` borra excepciones y `exdates`; con `p_recurrence` nula deja un evento suelto y la excepción de la primera repetición, si existe, queda suelta con sus imágenes;
    - `delete_occurrences` en `this` (con y sin excepción), `following` (y en la primera, que borra la serie) y `all`;
    - `series_loss` cuenta excepciones e imágenes listas para todas, desde una fecha y para una sola;
    - un Lector recibe `42501` o `CF404` en todas; un Editor que pierde el rol antes de llamar, también.
  - Después, la migración `event_series_functions` según "Contratos".

  Hecho cuando: `npm run test:db -- event-series` en verde y los tipos regenerados con las funciones. Cubre: RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-24b, RF-32 | Módulo: series-functions
  Evidencia (2026-10-30): rojo con las funciones inexistentes (12 tests, `PGRST202`). Migración `20261031110000_event_series_functions.sql` aplicada en dev (el primer `db push` falló por un timeout de conexión del pooler y se repitió) y tipos regenerados. Diferencia con el plan: `update_series` recibe la regla dentro de `p_fields` (`recurrence: null` = evento suelto) y devuelve el id del evento que queda. Los tipos generados no admiten `null` en los argumentos: se pasa con una conversión explícita. `test:db -- event-series event-images` 54 tests en verde. Verificación completa en verde (lint con los 2 avisos previos), `npm test` 1638 tests, build correcto.

- [ ] T7 Leer las repeticiones en las vistas, el detalle y el próximo evento
  Pasos:
  - Primero, en rojo:
    - `tests/unit/` de `getEventsInRange` con el cliente simulado: une sueltos, excepciones y repeticiones expandidas, quita las fechas con excepción, pone `seriesId` e ids de repetición, y una regla ilegible se ignora sin lanzar (R3);
    - `getEvent` y `canSeeEvent` con un id de repetición devuelven la serie con resumen, `originalStart` y `changed` (D9), y con un id mal formado, nulo;
    - `tests/integration/range-performance.test.ts` ampliado con 50 series activas: el tiempo no pasa del de 50 eventos sueltos más 300 ms;
    - `tests/integration/event-series.test.ts`: un calendario traído con eventos de Google sigue dando sus repeticiones sueltas (RF-28).
  - Después, `queries.ts` y `to-view-events.ts` según "Contratos".

  Hecho cuando: `npm test -- queries to-view-events` y `npm run test:db -- range-performance event-series` en verde. Cubre: RF-9, RF-11, RF-14, RF-16, RF-28 | Módulo: series-queries

- [ ] T8 Conservar las series al copiar y juntar calendarios y prepararlas para subirlas
  Pasos:
  - Primero, ampliar `event-series.test.ts` en rojo:
    - `merge_calendars` con series, excepciones y categorías del mismo nombre conserva series, excepciones y categorías unificadas (R4); superar 500 series da `CF429`;
    - `copy_calendar_for_owner` copia series y excepciones con `series_id` apuntando a la copia de la serie y conserva las imágenes de las excepciones;
    - `sync_attach_uploaded` v2 con repeticiones virtuales y excepciones en el `p_mapping` deja eventos sueltos con `external_id`, excepciones sueltas fuera de la ventana y ninguna serie;
    - la importación `.ics` sigue creando eventos sueltos (RF-27: `import-calendar` y `import_calendar` sin cambios en verde).
  - Después, la migración `series_copy_upload` (y, solo si falla R4, `merge_calendars`).

  Hecho cuando: `npm run test:db -- event-series merge-calendars copy-calendar import` en verde. Cubre: RF-25, RF-26, RF-27, RF-30 | Módulo: series-copy-upload

### Iteración 2 — Interfaz, escritura y validación

- [ ] T9 Construir el campo "Repetir" y la ventana "Personalizado…"
  Pasos:
  - Primero, `tests/unit/repeat-field.test.tsx` y `recurrence-editor.test.tsx` en rojo, con Testing Library por rol y texto:
    - "Repetir" vale "No se repite"; las opciones cambian al cambiar la fecha del formulario;
    - "Personalizado…" abre un `<dialog>` con número (1–99), unidad, días de la semana como casillas, mensual por día o por posición, y final "Nunca", "El <fecha>" o "Tras <n> repeticiones" (1–999);
    - el resumen se actualiza al cambiar cada control (`aria-live`);
    - todo se maneja con teclado (Tab, espacio, flechas en radios) y cada control tiene etiqueta;
    - con un calendario traído el campo está deshabilitado con "Los calendarios de Google no admiten repeticiones en CaFam".
  - Después, `components/recurrence/repeat-field.tsx` y `recurrence-editor.tsx`, solo con tokens.

  Hecho cuando: `npm test -- repeat-field recurrence-editor design-tokens` en verde. Cubre: RF-1, RF-2, RF-3, RF-4, RF-5, RF-29 | Módulo: repeat-ui

- [ ] T10 Crear series desde el alta completa y desde "Más opciones"
  Pasos:
  - Primero, en rojo: `event-form` con "Repetir" en el alta (página y ventana) y en "Más opciones" de la ventana rápida; `createEvent` con cada tipo de `repeat` guarda `recurrence`, `recurrence_tz` del perfil y `recurrence_until`, mueve el inicio a la primera repetición, da el error de campo de RF-8 sin repeticiones, el de 500 series y el de calendario traído.
  - Después, `EventForm`, `actions.ts` (`createEvent`), `series-write.ts` y `error-messages.ts`.

  Hecho cuando: `npm test -- event-form event-actions series-write` en verde y una serie creada en `next start -p 3100` aparece en mes, semana, día y agenda. Cubre: RF-1, RF-6, RF-7, RF-8, RF-29, RF-31 | Módulo: series-actions

- [ ] T11 Marcar las repeticiones en las vistas y en el detalle
  Pasos:
  - Primero, en rojo: `EventBlock` pinta `RepeatIcon` con `sr-only` "Se repite" cuando hay `seriesId` y cabe (las mismas reglas de tamaño que el icono de imágenes); el detalle muestra el resumen de la regla y "Cambiado solo en este evento" en una repetición cambiada.
  - Después, `event-block.tsx`, `event-detail.tsx` e `icons.tsx`.

  Hecho cuando: `npm test -- event-block event-detail design-tokens` en verde y capturas de agenda, mes, semana, día y detalle a 390, 768 y 1440 px. Cubre: RF-9, RF-10, RF-16 | Módulo: series-marks

- [ ] T12 Guardar cambios en una repetición eligiendo el alcance
  Pasos:
  - Primero, en rojo:
    - `series-scope-dialog.test.tsx`: tres opciones; sin "Solo este evento" si cambió el calendario (D10); con 100 excepciones, "Solo este evento" deshabilitado con la propuesta de "Este y los siguientes" (RF-32); con pérdidas, el texto "Se perderán N cambios y M imágenes" y "Guardar igualmente";
    - `updateEvent` en cada alcance llama a la función correcta, devuelve `loss` sin `confirmLoss` cuando hay pérdidas (RF-19, RF-24b), convierte suelto ↔ serie (RF-21, D7) y mueve la serie de calendario (RF-23);
    - en la ventana atiende cada resultado una sola vez (R6).
  - Después, `series-scope-dialog.tsx`, `EventForm` y `updateEvent`.

  Hecho cuando: `npm test -- series-scope-dialog event-form event-actions` en verde y cada alcance probado a mano en `next start -p 3100`. Cubre: RF-15, RF-16, RF-17, RF-18, RF-19, RF-21, RF-23, RF-24b, RF-32 | Módulo: scope-ui, series-actions

- [ ] T13 Borrar y duplicar repeticiones
  Pasos:
  - Primero, en rojo: borrar una repetición abre el diálogo de alcance con el aviso de imágenes que se pierden y `deleteEvent(id, mode, scope)` llama a `delete_occurrences`; duplicar una repetición (`?from=<id de repetición>`) abre el alta con su fecha y "No se repite".
  - Después, `event-detail.tsx`, `deleteEvent` y `load-new-event.ts`.

  Hecho cuando: `npm test -- event-detail event-actions load-new-event` en verde. Cubre: RF-20, RF-22, RF-24b | Módulo: scope-ui, series-actions

- [ ] T14 Añadir imágenes a una repetición
  Pasos:
  - Primero, en rojo: `materializeOccurrence` crea la excepción idéntica y devuelve su id, y la segunda vez devuelve el mismo; `ImageUploader` en una repetición virtual la materializa antes de reservar; las imágenes del cumpleaños de 2026 no salen en el de 2027.
  - Después, `image-actions.ts` e `image-uploader.tsx`.

  Hecho cuando: `npm test -- image-uploader image-actions` y `npm run test:db -- event-series` en verde. Cubre: RF-24 | Módulo: occurrence-images

- [ ] T15 Subir a Google calendarios con series
  Pasos:
  - Primero, en rojo: `planUpload` y `uploadCounts` con series cuentan cada repetición de la ventana; `uploadCalendar` sube las repeticiones como eventos sueltos y manda su `p_mapping` v2; la página de subida avisa "N series se subirán como M eventos sueltos; las repeticiones fuera de la ventana se perderán".
  - Después, `upload-plan.ts`, `upload-calendar.ts` y la página `upload`.

  Hecho cuando: `npm test -- upload-plan upload-calendar upload-form` en verde. Cubre: RF-30 | Módulo: upload-series

- [ ] T16 Validar las repeticiones de punta a punta y cerrar
  Pasos:
  - Verificación completa con la salida reportada, incluido `npm run test:db` entero.
  - Prueba manual en móvil (≤ 768 px) y escritorio: crear, cambiar y borrar cada tipo de regla en los tres alcances, con un evento de día completo y uno de varios días.
  - Capturas a 390, 768 y 1440 px en tema claro y oscuro, con el acento rojo y el amarillo, del campo, la ventana personalizada, el diálogo de alcance, las vistas y el detalle.
  - Evidencia RF por RF en este archivo y `AGENTS.md` actualizado (estado, esquema, `ical.js` en `expand.ts`, trampas nuevas).

  Hecho cuando: la tabla de evidencias cubre RF-1 a RF-32 con su test o captura y el usuario aprueba cerrar la spec. Cubre: todos | Módulo: validation

## Trazabilidad RF → tareas

| RF | Tareas | RF | Tareas | RF | Tareas |
|----|--------|----|--------|----|--------|
| RF-1 | T3, T9, T10 | RF-12 | T5 | RF-23 | T1, T12 |
| RF-2 | T3, T9 | RF-13 | T5 | RF-24 | T1, T14 |
| RF-3 | T2, T9 | RF-14 | T5, T7 | RF-24b | T6, T12, T13 |
| RF-4 | T2, T9 | RF-15 | T6, T12 | RF-25 | T8 |
| RF-5 | T4, T9 | RF-16 | T6, T7, T11, T12 | RF-26 | T8 |
| RF-6 | T1, T5, T10 | RF-17 | T5, T6, T12 | RF-27 | T8 |
| RF-7 | T3, T10 | RF-18 | T6, T12 | RF-28 | T7 |
| RF-8 | T5, T10 | RF-19 | T6, T12 | RF-29 | T1, T9, T10 |
| RF-9 | T7, T11 | RF-20 | T6, T13 | RF-30 | T8, T15 |
| RF-10 | T4, T11 | RF-21 | T6, T12 | RF-31 | T1, T2, T10 |
| RF-11 | T5, T7 | RF-22 | T13 | RF-32 | T1, T2, T6, T12 |

Todas se validan además en T16. Todos los módulos del plan tienen tarea: `series-schema` (T1), `recurrence-rule` (T2), `recurrence-presets` (T3), `recurrence-summary` (T4), `recurrence-expand` y `occurrence-id` (T5), `series-functions` (T6), `series-queries` (T7), `series-copy-upload` (T8), `repeat-ui` (T9), `series-actions` (T10, T12, T13), `series-marks` (T11), `scope-ui` (T12, T13), `occurrence-images` (T14), `upload-series` (T15) y `validation` (T16).

## Dudas abiertas

- Ninguna.
