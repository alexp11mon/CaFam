# Plan 013 — Eventos recurrentes

Spec de origen: `specs/013-eventos-recurrentes/spec.md` (aprobada el 2026-10-29). Plan aprobado el 2026-10-30. Constitución: `docs/constitution.md` (enmienda 3: `ical.js` también para expandir reglas de repetición, en módulos de `src/lib/` del servidor o puros).

## Resumen de arquitectura

- **Datos:** una serie es **una fila de `events`** con la regla (`recurrence`, texto RRULE sin `DTSTART`), la zona de reloj de quien la creó (`recurrence_tz`), la cota de su última repetición (`recurrence_until`) y las fechas canceladas (`exdates`). Sus `starts_at`/`ends_at` son los de la **primera repetición**. Las repeticiones no se guardan: se **expanden al leer**. Una repetición cambiada (o que necesita existir para guardar imágenes) es **otra fila de `events`** con `series_id` y `original_start` (la fecha original, como `RECURRENCE-ID`). Todo vive en `events`, así que RLS, categorías, colores, imágenes y, en la 014, comentarios funcionan sin tablas nuevas (P3).
- **Lectura:** `getEventsInRange` hace tres consultas con la sesión (eventos sueltos y excepciones que solapan el rango, series activas en el rango y las claves de sus excepciones) y expande las series en el servidor con `ical.js` en hora de reloj, convirtiendo cada repetición a UTC con `zonedLocalToUtc` en `recurrence_tz`. Todas las pantallas que ya usan esa función (vistas, agenda continua, mini calendario, "Próximo evento") reciben las repeticiones sin cambios.
- **Escritura:** crear una serie es un `insert` normal. Cambiar o borrar una repetición pasa por funciones `SECURITY INVOKER` (una transacción, RLS aplicada) según el alcance: "Solo este evento", "Este y los siguientes" o "Todos los eventos". Antes de guardar, `series_loss` cuenta las excepciones e imágenes que se perderían y la acción pide confirmación.

```
EventForm ── RepeatField (select de opciones rápidas + "Personalizado…" → RecurrenceEditor) ── campo oculto `repeat`
   │            (presets.ts, summary.ts: puros, sin ical.js)
   ▼
createEvent ─ resolveRepeat(repeat, fecha) → RRULE ─ expand.firstOccurrence / seriesBound (RF-8) ─ insert events (recurrence…)
                                                                          └ trigger enforce_series_rules: 500 series, no traído (RF-29, RF-31)
updateEvent / deleteEvent (repetición) ── SeriesScopeDialog (RF-15, RF-20) ── series_loss (RF-19, RF-24b) ── confirmación
   ├ this      → update_occurrence (excepción; 100 como mucho, RF-32) / delete_occurrences('this')
   ├ following → split_series (trunca la original, crea la nueva, reubica o descarta excepciones)
   └ all       → update_series / delete_occurrences('all')

getEventsInRange(from, to)
   ├ events sueltos y excepciones que solapan [from, to)        (recurrence is null)
   ├ series con starts_at < to y (recurrence_until ≥ from o nula)
   ├ claves (series_id, original_start) de sus excepciones
   └ expandSeries(serie, from, to, claves + exdates) ─ ical.js en hora de reloj ─ zonedLocalToUtc(recurrence_tz)
        → CalendarEventRecord { id: "<serie>_<YYYYMMDDTHHMMSSZ>", seriesId, … }
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `series-schema` | `supabase/migrations/<ts>_event_series.sql` | Columnas nuevas de `events`, `check`, FK compuesta de la excepción a su serie (`on update cascade`, `on delete cascade`), índices, trigger `enforce_series_rules` (500 series por calendario, 100 excepciones por serie, nunca en un calendario traído, excepción en el mismo calendario que su serie) y `reserve_event_images` que rechaza series | No expande reglas | RF-6, RF-23, RF-24, RF-29, RF-31, RF-32 |
| `series-functions` | `supabase/migrations/<ts>_event_series_functions.sql` | `update_occurrence`, `split_series`, `update_series`, `delete_occurrences` y `series_loss` (`SECURITY INVOKER`, una transacción cada una) | No calcula reglas: recibe la RRULE ya truncada desde TypeScript | RF-15 a RF-21, RF-24, RF-24b, RF-32 |
| `series-copy-upload` | `supabase/migrations/<ts>_series_copy_upload.sql` | `copy_calendar_for_owner` copia series y excepciones reasignando `series_id`; `sync_attach_uploaded` v2 crea filas para las repeticiones subidas, suelta las excepciones y borra las series | No cambia `merge_calendars` (la FK en cascada basta; se comprueba con test) | RF-25, RF-26, RF-30 |
| `recurrence-rule` | `src/lib/recurrence/rule.ts`, `limits.ts`, `schemas.ts` | Tipo `RecurrenceRule` (frecuencia, intervalo 1–99, días, modo mensual por día o por posición, final nunca / fecha / 1–999 veces), `toRRule` y `fromRRule` con solo las partes admitidas, y su esquema `zod` | No importa `ical.js` (se usa en el navegador) | RF-3, RF-4, RF-31, RF-32 |
| `recurrence-presets` | `src/lib/recurrence/presets.ts` | Las opciones rápidas para una fecha de inicio ("el 2.º martes", "el último viernes" solo si es el último…) y `resolveRepeat(valor, fecha)`: del valor del campo a la regla | — | RF-1, RF-2, RF-7 |
| `recurrence-summary` | `src/lib/recurrence/summary.ts` | Resumen en español de una regla ("Cada 2 semanas el lunes y el jueves, 10 veces") | — | RF-5, RF-10 |
| `recurrence-expand` | `src/lib/recurrence/expand.ts` (solo servidor; segundo y último módulo que importa `ical.js`) | `expandSeries` (rango, hora de reloj, cambio de horario, meses sin el día, bisiestos, día completo sin zona, repeticiones de varios días que se solapan, salto rápido), `firstOccurrence`, `seriesBound` y `truncateBefore` (UNTIL o COUNT restante para "Este y los siguientes") | No lee la base de datos | RF-6, RF-8, RF-11, RF-12, RF-13, RF-14, RF-17 |
| `occurrence-id` | `src/lib/recurrence/occurrence-id.ts` | `occurrenceId(serieId, originalStart)` → `"<uuid>_<YYYYMMDDTHHMMSSZ>"` y `parseEventId(id)` (uuid suelto o repetición) | — | RF-9, RF-15, RF-20, RF-22 |
| `series-queries` | `src/lib/calendar/queries.ts` (`getEventsInRange`, `getEvent`, `canSeeEvent`), `src/lib/calendar/to-view-events.ts` | Las tres consultas y la expansión; `CalendarEventRecord` gana `seriesId`. `getEvent` acepta ids de repetición y devuelve la serie (regla, resumen, `originalStart`, si la repetición está cambiada) | No escribe | RF-9, RF-10, RF-11, RF-14, RF-16, RF-28 |
| `series-actions` | `src/app/dashboard/events/actions.ts`, `src/lib/recurrence/series-write.ts`, `src/lib/recurrence/error-messages.ts` | `createEvent` con `repeat`; `updateEvent` y `deleteEvent` con `scope` y `confirmLoss`; `materializeOccurrence` para las imágenes. `series-write.ts` traduce alcance → función y SQLSTATE → español | No decide permisos (RLS y el trigger) | RF-6, RF-8, RF-15 a RF-23, RF-24, RF-24b, RF-29, RF-31, RF-32 |
| `repeat-ui` | `src/components/recurrence/repeat-field.tsx`, `recurrence-editor.tsx` | Campo "Repetir" en `EventForm` (opciones recalculadas al cambiar la fecha) y ventana "Personalizado…" con resumen en vivo, entera con teclado; deshabilitado con explicación si el calendario es traído | — | RF-1 a RF-5, RF-7, RF-29 |
| `scope-ui` | `src/components/recurrence/series-scope-dialog.tsx` | Pregunta "Solo este evento / Este y los siguientes / Todos los eventos" al guardar y al borrar, con el aviso de pérdidas y la propuesta de "Este y los siguientes" al llegar a 100 excepciones | — | RF-15, RF-19, RF-20, RF-24b, RF-32 |
| `series-marks` | `components/calendar/event-block.tsx`, `event-detail.tsx`, `components/shell/icons.tsx` (`RepeatIcon`) | Icono de repetición en los bloques donde quepa (`sr-only` "Se repite"), resumen de la regla en el detalle y "Cambiado solo en este evento" | — | RF-10, RF-16 |
| `occurrence-images` | `components/images/image-uploader.tsx`, `app/dashboard/events/image-actions.ts` | En una repetición sin fila, "Añadir imágenes" primero la materializa (excepción sin cambios) y sube a esa fila | No cambia Storage ni los límites | RF-24 |
| `upload-series` | `src/lib/sync/upload-calendar.ts`, `upload-plan.ts`, `app/dashboard/calendars/[id]/upload` | Expande las series en la ventana de sincronización, sube cada repetición como evento suelto y avisa antes (cuántas series, cuántas repeticiones se suben y que las de fuera se pierden) | — | RF-30 |
| `validation` | `tests/unit/recurrence-*.test.ts`, `tests/integration/event-series.test.ts`, `range-performance.test.ts`, capturas | Matriz de reglas (horario de verano, día 31, 29 de febrero, inicio que no coincide), permisos, límites, ciclo de vida (juntar, copiar, subir), rendimiento y regresión de `.ics` y Google | — | todos, RF-27, RF-28 |

## Modelo de datos

### Columnas nuevas de `public.events`

| Columna | Tipo | Notas |
|---------|------|-------|
| `recurrence` | `text` nula | RRULE sin `DTSTART` (p. ej. `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=10`). No nula = la fila es una **serie**. `check`: longitud ≤ 200 y patrón `^FREQ=(DAILY\|WEEKLY\|MONTHLY\|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$`. La validación fina la hace `zod` (`fromRRule`); una regla ilegible en lectura se ignora y se registra en el servidor (R3) |
| `recurrence_tz` | `text` nula | Zona del perfil de quien creó la serie (RF-12). Obligatoria en series con hora, nula en las de día completo (`check`) y validada como `profiles.time_zone`. No cambia al editar la serie ni al partirla |
| `recurrence_until` | `timestamptz` nula | Fin de la última repetición, calculado al guardar (`seriesBound`); nula = sin fin. Solo sirve para filtrar el rango |
| `exdates` | `timestamptz[] not null default '{}'` | `original_start` de las repeticiones borradas con "Solo este evento" |
| `series_id` | `uuid` nula | Excepción: la serie a la que pertenece |
| `original_start` | `timestamptz` nula | Excepción: inicio original de la repetición que sustituye (en día completo, 00:00 UTC del día) |

Restricciones:

- `check ((series_id is null) = (original_start is null))` y `check (recurrence is null or series_id is null)`: una serie no es excepción de otra.
- `unique (id, calendar_id)` y FK `(series_id, calendar_id) references events (id, calendar_id) on update cascade on delete cascade`: mover la serie mueve sus excepciones (RF-23) y borrarla las borra; una excepción no puede estar en otro calendario.
- `unique (series_id, original_start)`: una excepción por repetición.
- Índices: `(calendar_id, starts_at) where recurrence is not null` y `(series_id)`.

Trigger `enforce_series_rules` (`before insert or update`, `SECURITY DEFINER` solo para contar, `search_path = ''`):

- Fila con `recurrence` en un calendario traído (`is_synced_calendar`) → `22023` (RF-29).
- Fila que pasa a ser serie o cambia de calendario con 500 series ya en el destino → `CF429` con mensaje `series` (RF-31). Vale también para juntar calendarios.
- Excepción nueva o `exdates` más largo cuando la serie ya suma 100 entre filas y `exdates` → `CF429` con mensaje `exceptions` (RF-32).

Permisos: ninguna política nueva. Series y excepciones son eventos y siguen las de `events` (leen los miembros, escriben propietario y Editor, nunca en traídos). `reserve_event_images` (`create or replace`) devuelve `22023` si el evento es una serie: las imágenes siempre van a una fila de repetición (RF-24).

### Convenciones

- **Repetición virtual**: no tiene fila; su id es `occurrenceId(serie, originalStart)`. Tiene 0 imágenes.
- **Repetición cambiada**: excepción cuyo contenido difiere de lo que daría la serie. Una excepción idéntica (creada para guardar imágenes) se muestra como una repetición normal (D9).
- **Día completo**: la regla se expande por fecha UTC sin zona (`recurrence_tz` nula), como la convención de la spec 002 (RF-14).
- **Duración**: la de la primera repetición, en hora de reloj para las de hora (un evento de 18:00 a 19:30 sigue siéndolo tras el cambio de horario) y en días para las de día completo.

## Contratos e interfaces

### Funciones SQL (`SECURITY INVOKER`, `search_path = ''`)

| Función | Contrato | Errores |
|---------|----------|---------|
| `update_occurrence(p_series_id uuid, p_original_start timestamptz, p_fields jsonb) returns uuid` | Crea o actualiza la excepción de esa repetición con los campos dados (título, descripción, lugar, inicio, fin, día completo, color, categoría). Con `p_fields = '{}'` y sin excepción previa, la crea idéntica (para imágenes). Devuelve el id | `CF404` serie no visible o repetición inexistente; `CF429 exceptions`; `42501` sin permiso |
| `split_series(p_series_id uuid, p_original_start timestamptz, p_old_recurrence text, p_old_until timestamptz, p_new jsonb, p_keep_exceptions boolean) returns uuid` | "Este y los siguientes": pone a la serie la regla truncada, crea la serie nueva desde esa repetición con los cambios y, si `p_keep_exceptions`, reasigna a la nueva las excepciones con `original_start >= p_original_start` aplicándoles los campos que no contradicen el cambio; si no, las borra. Devuelve la serie nueva | `CF404`, `CF429 series`, `22023` |
| `update_series(p_series_id uuid, p_fields jsonb, p_recurrence text, p_until timestamptz, p_shift interval, p_drop_exceptions boolean)` | "Todos los eventos": cambia la serie. Con `p_drop_exceptions` borra excepciones y `exdates` (RF-19). Si no, propaga a cada excepción los campos cuyo valor coincidía con el de la serie (RF-18) y desplaza `original_start` y las horas no cambiadas en `p_shift` si solo cambió la hora. Con `p_recurrence` nula convierte la serie en evento suelto (RF-21, D7) | `CF404`, `22023` |
| `delete_occurrences(p_series_id uuid, p_original_start timestamptz, p_scope text, p_recurrence text, p_until timestamptz)` | `this`: borra la excepción si existe y añade la fecha a `exdates`. `following`: trunca la regla (`p_recurrence`) y borra las excepciones desde esa fecha; si es la primera, borra la serie. `all`: borra la serie (y sus excepciones en cascada) | `CF404`, `CF429 exceptions` |
| `series_loss(p_series_id uuid, p_from timestamptz, p_only timestamptz) returns table (exceptions int, images int)` | Excepciones e imágenes listas que desaparecerían: todas (`p_from` nulo), desde una fecha o solo una repetición (`p_only`). La 014 le añadirá los comentarios | `CF404` |
| `sync_attach_uploaded(..., p_mapping jsonb)` v2 | Cada elemento lleva `event_id` (evento suelto o excepción) **o** `series_id` + `original_start` + `starts_at` + `ends_at` (repetición virtual, que se inserta con los datos de la serie). Después suelta las excepciones del calendario (`series_id = null`) y borra sus series | los de la 009 |

### TypeScript

- `RecurrenceRule = { freq: "daily" | "weekly" | "monthly" | "yearly"; interval: number; byDay?: Weekday[]; monthly?: { day: number } | { pos: 1 | 2 | 3 | 4 | -1; weekday: Weekday }; end: { kind: "never" } | { kind: "until"; date: string } | { kind: "count"; count: number } }`. `toRRule` siempre escribe las partes `BY*` explícitas (D5).
- Campo `repeat` del formulario: `"none"`, una opción rápida (`"daily"`, `"weekly"`, `"monthly-day"`, `"monthly-pos"`, `"monthly-last"`, `"yearly"`, `"weekdays"`) o `"custom:<RRULE>"`. `resolveRepeat(repeat, dateKey)` → `RecurrenceRule | null` o error.
- `expandSeries(series, from, to, skip: Set<number>) → { originalStart, startsAt, endsAt }[]`; `firstOccurrence(series) → … | null` (null = RF-8); `seriesBound(series) → Date | null`; `truncateBefore(series, originalStart) → { recurrence, until }`.
- `CalendarEventRecord.seriesId: string | null` (id de la serie en repeticiones y excepciones). `EventRecord.series: { id; recurrence; summary; originalStart; changed: boolean } | null`.
- Acciones: `createEvent` lee `repeat`; `updateEvent` y `deleteEvent(id, mode, scope)` leen `scope` (`this | following | all`) y `confirmLoss=1`. Si hay pérdidas sin confirmar devuelven `{ loss: { exceptions, images } }` (nuevo campo de `FormState` y `ConfirmState`) y no guardan. `materializeOccurrence(occurrenceId) → { eventId } | { formError }`.
- Mensajes (`RECURRENCE_MESSAGES`): `empty` ("Con este final la serie no tiene ninguna repetición"), `series` ("Este calendario ya tiene 500 series"), `exceptions` ("Esta serie ya tiene 100 cambios sueltos. Usa «Este y los siguientes»"), `synced` ("Los calendarios de Google no admiten repeticiones en CaFam"), `calendarThis` ("Para cambiar de calendario, elige «Todos los eventos» o «Este y los siguientes»").

## Flujo principal paso a paso

1. **Crear** (RF-1 a RF-8): el usuario abre el alta (o "Más opciones" desde la ventana rápida, RF-7) → "Repetir" muestra las opciones de la fecha elegida, que se recalculan si cambia la fecha (`presets.ts`) → "Personalizado…" abre `RecurrenceEditor` con el resumen en vivo (RF-3 a RF-5) → `createEvent` valida con `zod`, resuelve la regla con la fecha, calcula la primera repetición (si el inicio no coincide con la regla, el evento se mueve a ella) y la cota; sin repeticiones → error de campo (RF-8) → `insert` con `recurrence`, `recurrence_tz` (zona del perfil leída en el servidor) y `recurrence_until`; el trigger aplica RF-29 y RF-31.
2. **Ver** (RF-9 a RF-14): cualquier vista pide su rango → `getEventsInRange` expande las series dentro de él, quita las fechas con excepción o en `exdates` y añade las excepciones como eventos normales → los bloques muestran el icono si cabe; el detalle, el resumen.
3. **Cambiar** (RF-15 a RF-19, RF-21, RF-23, RF-32): guardar en una repetición abre `SeriesScopeDialog` → la acción calcula las pérdidas con `series_loss` (RF-19, RF-24b); si las hay, devuelve `loss` y el diálogo pide confirmar → `this` → `update_occurrence`; `following` → `truncateBefore` + `split_series`; `all` → `update_series`. Cambiar de calendario no ofrece "Solo este evento" (D10).
4. **Borrar** (RF-20, RF-24b): igual, con `delete_occurrences`.
5. **Imágenes** (RF-24): en una repetición virtual, "Añadir imágenes" llama a `materializeOccurrence` y sube a la fila creada; desde entonces esa repetición tiene id propio.
6. **Subir a Google** (RF-30): la página de subida cuenta series y repeticiones dentro de la ventana y avisa → `uploadCalendar` sube cada repetición como evento suelto → `sync_attach_uploaded` v2 deja el calendario sin series.

## Decisiones técnicas

- **D1: la serie es una fila de `events` y las excepciones también.** Descartada una tabla `event_series` aparte, porque obligaría a duplicar las políticas, las categorías, los colores, las imágenes y, en la 014, los comentarios. Motivo: reutiliza RLS y todo lo que ya cuelga de `events`. Cubre: RF-9, RF-23, RF-24, RF-25, P3.
- **D2: expandir al leer, sin guardar las repeticiones.** Descartado materializar las repeticiones en una ventana móvil con un trabajo de `pg_cron`, porque RF-11 pide cualquier fecha futura y un cambio de "Todos los eventos" reescribiría cientos de filas. Motivo: una sola fila por serie y lecturas en el rango visible. Cubre: RF-11, RF-18.
- **D3: expandir con `ical.js` en hora de reloj y convertir con `zonedLocalToUtc`.** Descartado usar zonas de `ical.js`, que necesitan `VTIMEZONE` y no conocen las de `Intl`. Motivo: el proyecto ya convierte así en la importación (trampa de `TZID`) y conserva las 18:00 en cualquier época (RF-12). Cubre: RF-6, RF-12, RF-13, RF-14.
- **D4: excepciones como filas con `original_start` y cancelaciones en `exdates`.** Descartado guardar las cancelaciones como filas marcadas, porque contarían como eventos en todas las consultas y en la FK de imágenes. Motivo: el modelo de `RECURRENCE-ID`/`EXDATE` de RFC 5545, que ya entiende `ical.js`. Cubre: RF-16, RF-20, RF-32.
- **D5: `toRRule` escribe siempre las partes `BY*` y, al guardar, la serie empieza en su primera repetición.** Descartado confiar en que `DTSTART` defina el día, porque RFC 5545 cuenta `DTSTART` como repetición aunque no cumpla la regla (caso "empieza un miércoles con cada lunes"). Motivo: la regla no depende del inicio, lo que también permite el salto rápido de D6. Cubre: RF-2, RF-3, casos límite.
- **D6: salto rápido para series diarias y semanales sin `COUNT`.** Antes de iterar, el inicio se adelanta un múltiplo entero de `INTERVAL` días o semanas hasta justo antes del rango. Descartado iterar siempre desde el inicio, porque una serie diaria de hace años son miles de pasos por vista. Mensuales y anuales iteran desde el inicio (12 o 1 por año). Motivo: requisito de rendimiento (≤ 300 ms con 50 series). Cubre: RF-11, rendimiento.
- **D7: las imágenes y los comentarios cuelgan de filas de repetición; una serie nunca tiene imágenes.** Una repetición virtual se materializa (excepción idéntica) al añadir la primera imagen. Convertir un evento suelto con imágenes en serie crea una fila de serie **nueva** y deja el evento original como excepción de su primera repetición; convertir una serie en suelto suelta la excepción de la primera repetición (si existe) y borra la serie. Descartado mover filas de `event_images` entre eventos, que exigiría una función `SECURITY DEFINER` más. Motivo: los ids y las imágenes nunca cambian de dueño. Cubre: RF-21, RF-24.
- **D8: funciones `SECURITY INVOKER` por alcance; la regla truncada se calcula en TypeScript.** Descartado hacer toda la lógica en el servidor sin transacción (dos o tres escrituras podían quedar a medias) y descartado expandir RRULE en plpgsql. Motivo: atomicidad en Postgres, `ical.js` solo en TypeScript y RLS en cada escritura (P3). Cubre: RF-15 a RF-20.
- **D9: "cambiada" se calcula comparando la excepción con lo que daría la serie.** Descartada una columna `modified`, que habría que mantener en cada propagación de "Todos los eventos". Motivo: el detalle ya carga la serie para el resumen. Cubre: RF-16.
- **D10: cambiar de calendario solo con "Todos" o "Este y los siguientes".** La FK compuesta impide una excepción en otro calendario. Descartado sacar la repetición de la serie como evento suelto, que es otra funcionalidad. Motivo: RF-23 solo pide mover la serie entera. Cubre: RF-23.
- **D11: "Este y los siguientes" conserva las excepciones posteriores solo si no cambian la regla ni la hora de inicio**, con la misma propagación que "Todos los eventos"; si cambian, las descarta con aviso. Descartado conservarlas siempre, porque sus `original_start` ya no coincidirían con ninguna repetición. Motivo: misma regla que RF-18 y RF-19. Cubre: RF-17, RF-24b.
- **D12: "Todos los eventos" con solo un cambio de hora desplaza las excepciones** (`p_shift`) en vez de descartarlas. Solo un cambio de regla o de fecha de inicio las descarta, como dice RF-19. Descartado tratar la hora como la fecha, que perdería imágenes sin que la spec lo pida. Cubre: RF-18, RF-19.
- **D13: el valor del campo guarda el tipo de opción rápida, no la regla**, y el servidor la resuelve con la fecha enviada. Descartado guardar la RRULE en el cliente, porque cambiar la fecha tras elegir "Cada semana el martes" dejaría un día que ya no corresponde. Motivo: igual que Google, la opción sigue a la fecha. Cubre: RF-2.
- **D14: subir a Google materializa en `sync_attach_uploaded`, al final.** Descartado convertir las series en eventos sueltos antes de subir, porque un fallo en Google dejaría CaFam cambiado (la 009 solo cambia CaFam al final, en una transacción). Cubre: RF-30.
- **D15: sin cambios en `merge_calendars`, en la importación ni en la sincronización.** La FK `on update cascade` mueve las excepciones al juntar y el trigger aplica el límite de 500; la importación sigue creando eventos sueltos y la sincronización solo toca filas con `external_id`. Se comprueba con tests. Cubre: RF-25, RF-27, RF-28.

## Trazabilidad RF → módulo

| RF | Módulos |
|----|---------|
| RF-1 | `repeat-ui`, `recurrence-presets` |
| RF-2 | `recurrence-presets`, `repeat-ui` (D5, D13) |
| RF-3 | `recurrence-rule`, `repeat-ui` |
| RF-4 | `recurrence-rule`, `repeat-ui` |
| RF-5 | `recurrence-summary`, `repeat-ui` |
| RF-6 | `recurrence-expand`, `series-schema`, `series-actions` |
| RF-7 | `repeat-ui`, `recurrence-presets` (el formulario completo de "Más opciones") |
| RF-8 | `recurrence-expand` (`firstOccurrence`), `series-actions` |
| RF-9 | `series-queries`, `occurrence-id` |
| RF-10 | `series-marks`, `recurrence-summary` |
| RF-11 | `recurrence-expand` (D2, D6), `series-queries` |
| RF-12 | `recurrence-expand` (D3), `series-schema` (`recurrence_tz`) |
| RF-13 | `recurrence-expand` |
| RF-14 | `recurrence-expand`, `series-queries` |
| RF-15 | `scope-ui`, `series-actions` |
| RF-16 | `series-functions` (`update_occurrence`), `series-marks` (D9) |
| RF-17 | `series-functions` (`split_series`), `recurrence-expand` (`truncateBefore`) (D11) |
| RF-18 | `series-functions` (`update_series`) (D12) |
| RF-19 | `series-functions` (`series_loss`), `scope-ui` |
| RF-20 | `series-functions` (`delete_occurrences`), `scope-ui` |
| RF-21 | `series-functions`, `series-actions` (D7) |
| RF-22 | `occurrence-id`, `series-queries` (`getEvent` en `load-new-event`) |
| RF-23 | `series-schema` (FK en cascada), `series-actions` (D10) |
| RF-24 | `series-schema` (`reserve_event_images`), `occurrence-images`, `series-functions` (D7) |
| RF-24b | `series-functions` (`series_loss`), `scope-ui`, `series-actions` |
| RF-25 | `series-schema` (FK, trigger), `validation` (D15) |
| RF-26 | `series-copy-upload` |
| RF-27 | `validation` (regresión de la importación) |
| RF-28 | `series-queries`, `validation` (regresión de la sincronización) |
| RF-29 | `series-schema` (trigger), `repeat-ui`, `series-actions` |
| RF-30 | `upload-series`, `series-copy-upload` (D14) |
| RF-31 | `series-schema` (trigger), `recurrence-rule` (`limits.ts`) |
| RF-32 | `series-schema` (trigger), `series-functions`, `scope-ui` |

## Riesgos y mitigaciones

- **R1: `ical.js` y los días que no existen** (día 31, 29 de febrero, "el 5.º martes"). RFC 5545 dice que se ignoran, pero hay que comprobarlo. Mitigación: tests de `expand.ts` con esos casos al principio (T4); si `ical.js` no los omite, `expandSeries` filtra las fechas que no cumplen la regla.
- **R2: rendimiento** de tres consultas y la expansión en cada vista. Mitigación: índice parcial de series, salto rápido (D6) y el test `range-performance` ampliado con 50 series activas (requisito: +300 ms como mucho).
- **R3: una regla guardada ilegible** (escrita a mano en la base de datos) rompería las vistas de todos los miembros. Mitigación: el `check` de patrón, `zod` al escribir y, al leer, `fromRRule` que ignora la serie y registra un aviso en el servidor en vez de lanzar.
- **R4: la FK en cascada y `merge_calendars`**, que mueve series y excepciones en la misma sentencia, junto con el trigger que quita la categoría al mover. Mitigación: test de integración de juntar con series, excepciones y categorías (T13); si falla, una migración `create or replace` de `merge_calendars` mueve primero las series.
- **R5: carreras** entre dos personas cambiando la misma serie. Mitigación: cada alcance es una transacción; gana la última (lo que pide la spec). Si la repetición ya no existe, `CF404` → "Esta repetición ya no existe".
- **R6: Activity y la ventana de evento (spec 008)** con el nuevo diálogo de alcance dentro de la ventana. Mitigación: el diálogo atiende cada resultado una vez (`handled`) y se cierra en la limpieza del efecto, como `EventModal`.
- **R7: el tamaño del bundle si `ical.js` llegara al cliente.** Mitigación: `expand.ts` solo se importa desde código de servidor; un test (como `no-secrets.test.ts`) falla si un archivo `"use client"` importa `ical.js` o `lib/recurrence/expand`.
- **R8: la spec 017 (arrastrar para mover)** tendrá que decidir el alcance al soltar una repetición. Fuera de esta spec; el modelo (excepción por `original_start`) ya lo permite.

## Dudas abiertas

- Ninguna.
