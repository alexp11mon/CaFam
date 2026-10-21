# Plan 004 — Importación de calendarios .ics

> Spec de origen: `specs/004-importacion-ics/spec.md` (aprobada el 2026-10-22). Constitución: `docs/constitution.md`. Estado: **Aprobado** por el usuario (2026-10-22), incluida la dependencia nueva `ical.js` 2.2.1 (D1), la hora flotante en la zona del perfil (D3) y el tope de recuento de 20.000 (D8).

## Resumen de arquitectura

Se amplía el monolito de las specs 001 a 003. Una Server Action recibe un enlace o un archivo `.ics`, lo lee **una sola vez** en el servidor, lo convierte a filas de eventos con lógica pura y las guarda con **una única función SQL transaccional** que crea el calendario y sus eventos (RLS sigue siendo la frontera). No hay tablas nuevas: el calendario importado es un calendario normal sin relación con su origen. La única dependencia nueva es `ical.js`, aislada en un solo módulo.

```
/dashboard/import (formulario) ──▶ Server Action importCalendar
     enlace ─▶ fetch-ics (https, IP pública, 15 s, 2 MB)   ┐
     archivo ─▶ read-source (≤ 2 MB)                       ┴▶ texto .ics
 texto ─▶ parse-ics (ical.js: eventos, repeticiones, excepciones, horizonte de 1 año)
       ─▶ convert-events (zona horaria, día completo, límites de texto, omitidos)
       ─▶ rpc import_calendar(nombre, color, eventos jsonb) ─▶ calendario nuevo + eventos (una transacción)
       ─▶ resumen: creados, omitidos, series cortadas + enlace al calendario
```

## Módulos y responsabilidades

### SQL (migración nueva, nunca se editan las ya aplicadas)

- `import_calendar(p_name, p_color, p_events)` (`SECURITY INVOKER`, una transacción): crea el calendario del llamante y sus eventos desde un `jsonb`. No lee ni guarda el origen, no deduplica y no crea tablas ni columnas. Cubre: RF-7, RF-11, RF-12, RF-30 (y RF-27 como defensa).

### Lógica pura y acceso externo (`src/lib/ics/`)

- `limits.ts`: constantes de los límites (2 MB, 2.000 eventos, 12 meses, 15 s, 3 redirecciones, tope de recuento de 20.000). No hace nada más. Cubre: RF-5, RF-23, RF-26, RF-27.
- `source-url.ts`: valida el enlace escrito (solo `https`/`webcal`, puerto 443, sin usuario ni contraseña, sin IP privada escrita a mano) y convierte `webcal://` en `https://`. Cubre: RF-3, RF-4.
- `ip-guard.ts`: decide si una dirección IP (v4 o v6) es pública. No resuelve DNS. Cubre: RF-4.
- `fetch-ics.ts`: descarga el enlace con `node:https`, comprueba la IP **al conectar**, sigue hasta 3 redirecciones revalidando cada una, aplica el tiempo máximo y corta la lectura al pasar de 2 MB. No guarda ni registra la URL. Cubre: RF-1, RF-4, RF-5, RF-6, RF-26.
- `read-source.ts`: elige entre archivo y enlace del formulario y comprueba el tamaño del archivo. Cubre: RF-2, RF-26.
- `parse-ics.ts`: **único módulo que importa `ical.js`**. Lee el texto y devuelve ocurrencias con su hora "de pared" y su `TZID` (sin convertir): expande repeticiones hasta el horizonte, aplica exclusiones y repeticiones modificadas, omite eventos cancelados y devuelve el nombre del calendario y cuántas series se cortaron. No conoce zonas horarias ni la base de datos. Cubre: RF-9, RF-13, RF-20, RF-22, RF-23, RF-24, RF-25, RF-28.
- `convert-events.ts`: convierte ocurrencias a filas de evento: título por defecto, recorte de textos, instantes UTC en la zona de cada evento, día completo con la convención de la spec 002, fin por defecto, omisión de zonas desconocidas y de fines anteriores al inicio, y limpieza de caracteres que Postgres rechaza. Reutiliza `calendar/time-zone.ts`. Cubre: RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-21, RF-29.
- `import-calendar.ts`: orquesta origen → parseo → conversión y aplica los límites de eventos; no toca la base de datos (recibe el texto o una función de descarga, para poder probarlo sin red). Cubre: RF-27, RF-28, RF-29.
- `schemas.ts`: esquema `zod` del formulario (enlace o archivo, nombre opcional de hasta 50 caracteres, color de la paleta). Cubre: RF-8, RF-10.
- `error-messages.ts`: mensajes en español de cada fallo (enlace no válido, no se pudo leer, demasiado grande, demasiados eventos, no es un .ics, sin eventos importables, fallo al crear). Nunca incluye el enlace. Cubre: RF-4, RF-5, RF-6, RF-26, RF-27, RF-28, RF-30.

### Server Action y página

- `src/app/dashboard/import/actions.ts`: `importCalendar` (sesión, zona horaria del perfil, llamada a `runImport`, `rpc import_calendar`, `revalidatePath("/dashboard", "layout")`, estado con el resumen). Cubre: RF-1, RF-2, RF-7, RF-30, RF-31.
- `src/app/dashboard/import/page.tsx`: página síncrona con el formulario y `maxDuration`. Cubre: RF-32, RF-33.
- `next.config.ts` (modificado): `serverActions.bodySizeLimit` de 3 MB, para que el mensaje claro de RF-26 llegue antes que el error genérico de Next. Cubre: RF-26.
- `src/app/dashboard/page.tsx` (modificado): botón "Importar calendario". Cubre: RF-33.

### Componentes (`src/components/import/`)

- `import-form`: campos enlace y archivo, nombre y color (reutiliza `ColorPicker`), botón deshabilitado y texto "Importando…" mientras trabaja, errores junto al campo y como alerta, y comprobación del tamaño del archivo antes de enviar. Cubre: RF-1, RF-2, RF-8, RF-10, RF-26, RF-32.
- `import-summary`: eventos creados, omitidos y series cortadas, y enlace para abrir el calendario nuevo. Cubre: RF-31.

No hacen: ninguna tabla nueva, ni guardar enlaces o archivos, ni sincronizar, ni importar a un calendario existente, ni detectar duplicados. `/dashboard/*` ya exige sesión (RF-34, spec 001).

## Modelo de datos

Sin tablas, columnas ni políticas nuevas. El resultado son filas normales de `calendars` (propietario = quien importa, con su fila `owner` creada por el trigger existente) y de `events` (`created_by` = quien importa).

- Entrada de `import_calendar`: `p_name` (1 a 50 caracteres tras recortar, los mismos límites que ya impone la tabla), `p_color` (el azul de marca si es nulo; la paleta se valida en `zod`, no en SQL, igual que en la spec 002) y `p_events` (array JSON de `{ title, description, location, starts_at, ends_at, all_day }`).
- Validaciones: `p_events` debe ser un array de 1 a 2.000 elementos (`22023` si no); el resto lo imponen las restricciones de `events` (título 1 a 100, descripción ≤ 2000, lugar ≤ 200, `ends_at >= starts_at`). Cualquier fallo deshace todo (RF-30).
- Convención de eventos de día completo (spec 002): inicio a las 00:00 UTC del primer día y fin exclusivo a las 00:00 UTC del día siguiente al último; coincide con el `DTEND` exclusivo de iCalendar.
- Persistencia del origen: ninguna. El texto del `.ics` solo vive en memoria durante la petición (RF-6).

## Contratos e interfaces

### Server Action `importCalendar(prevState, formData)`

Campos: `url` (texto), `file` (archivo), `name` (texto, opcional), `color` (de la paleta, opcional). Se exige **exactamente uno** de `url` o `file`; si faltan ambos o llegan ambos, error de campo ("Indica un enlace o sube un archivo, no los dos."). Es validación del formulario, no un requisito nuevo.

Estado devuelto (mismo patrón de las specs 002 y 003: `fieldErrors`, `formError`, `values`), más `result?: { calendarId, created, skipped, cutSeries }` cuando termina bien. No hay `redirect()`: el resumen ofrece abrir el calendario (RF-31).

### Contrato de `parse-ics`

- Entrada: texto, fecha de hoy y horizonte (hoy + 12 meses).
- Salida: `{ calendarName | null, occurrences[], cutSeries, cancelled }` o error `not-ics` / `no-events`.
- Una ocurrencia: `uid`, `summary`, `description`, `location`, inicio y fin como campos de calendario (año, mes, día, hora, minuto, segundo) más `allDay` y la zona (`utc`, un `TZID` en texto o ninguna).

### Contrato de `convert-events`

- Entrada: ocurrencias y zona horaria del perfil. Salida: `{ events[], skipped }`.
- Una ocurrencia se omite (y suma a `skipped`) si su zona no es una zona IANA reconocida (RF-21) o si su fin es anterior a su inicio (RF-29).
- Sin zona ni `Z` (hora "flotante"): se interpreta en la zona del perfil (D3).

### Función SQL

| Función | Quién | Resultado | Errores |
|---------|-------|-----------|---------|
| `import_calendar(p_name text, p_color text, p_events jsonb)` | usuario con sesión | `uuid` del calendario nuevo | `22023` datos inválidos o más de 2.000 eventos; `23514` si una restricción de `events` falla (todo se deshace); `anon` sin acceso |

### Mensajes de error (español)

| Origen | Mensaje |
|--------|---------|
| enlace con otro protocolo, puerto o dirección no pública (RF-4) | "El enlace no es válido. Debe empezar por https:// o webcal://." |
| no se pudo descargar (RF-5) | "No se ha podido leer el enlace. Comprueba que es público y vuelve a intentarlo." |
| más de 2 MB (RF-26) | "El archivo supera el límite de 2 MB." |
| más de 2.000 eventos (RF-27) | "El calendario tendría N eventos y el límite es de 2.000." (o "más de 20.000" si se pasa del tope de recuento, D8) |
| no es un .ics (RF-28) | "El contenido no es un calendario .ics válido." |
| sin eventos importables (RF-28) | "El calendario no tiene eventos que se puedan importar." |
| fallo al crear (RF-30) | "No se ha podido crear el calendario. No se ha guardado nada." |
| ni enlace ni archivo, o ambos | "Indica un enlace o sube un archivo, no los dos." |

## Flujo principal paso a paso

1. La persona abre "Importar calendario" (RF-33; sin sesión el proxy ya la lleva a iniciar sesión, RF-34), pega un enlace o sube un archivo y, si quiere, pone nombre y color (RF-8, RF-10). El botón queda deshabilitado mientras trabaja (RF-32).
2. La acción comprueba que hay solo una fuente y valida el formulario con `zod`.
3. Enlace: `source-url` valida y normaliza (RF-3, RF-4); `fetch-ics` descarga una sola vez con comprobación de IP al conectar, redirecciones revalidadas, 15 s y 2 MB (RF-1, RF-4, RF-5, RF-26). Archivo: `read-source` comprueba el tamaño y lee el texto (RF-2, RF-26). Nada se guarda (RF-6).
4. `parse-ics` lee el texto: error si no es un `.ics` o no tiene eventos (RF-28); omite cancelados (RF-20); expande repeticiones hasta un año desde hoy con exclusiones y modificaciones (RF-22 a RF-25) y cuenta las series cortadas.
5. `convert-events` convierte cada ocurrencia (RF-13 a RF-19), omite las de zona desconocida o fin anterior al inicio (RF-21, RF-29) y limpia caracteres inválidos.
6. `import-calendar` aplica el límite de 2.000 eventos sobre el resultado ya convertido (RF-27) y comprueba que queda al menos un evento (RF-28).
7. La acción lee la zona del perfil en el servidor (nunca del cliente), elige el nombre (el escrito, el del `.ics` recortado o "Calendario importado", RF-8, RF-9) y llama a `import_calendar`: calendario y eventos se crean en una transacción o no se crea nada (RF-7, RF-30).
8. Tras `revalidatePath("/dashboard", "layout")`, el estado devuelve el resumen: creados, omitidos y series cortadas, con el enlace al calendario nuevo (RF-31).

## Decisiones técnicas

- D1: Dependencia nueva `ical.js` 2.2.1 (MPL-2.0, sin dependencias propias, ~1,2 MB desempaquetado, tipos incluidos, solo se carga en servidor). Descartado `node-ical` (arrastra `rrule-temporal` y `temporal-polyfill`, pensado para descargar él mismo sin control de SSRF) y descartado `ts-ics` + `rrule` (dos librerías y mucho código propio de unión). Motivo: lee `.ics`, expande repeticiones y aplica exclusiones y excepciones en una sola librería; se comprobó en un directorio aparte que respeta `EXDATE` y `RECURRENCE-ID` y que no se atasca con reglas imposibles. Requiere tu aprobación explícita (P6, ver Dudas abiertas). Cubre: RF-13, RF-20, RF-22 a RF-25, RF-28.
- D2: Las zonas horarias las resuelve nuestro código: `ical.js` deja los eventos con `TZID` como hora "de pared" sin zona (comprobado), así que se lee el `TZID`, se valida como zona IANA con `Intl` y se convierte cada ocurrencia con `zonedLocalToUtc` de la spec 002 (una conversión por ocurrencia, así una serie semanal sigue a las 10:00 locales aunque cambie el horario de verano). Descartado registrar los bloques `VTIMEZONE` del archivo: Outlook usa nombres de Windows y haría falta una tabla de equivalencias. Las zonas no reconocidas se omiten, como decidiste. Cubre: RF-16, RF-21.
- D3: Una hora sin zona ni `Z` (hora flotante) se interpreta en la zona del perfil de quien importa, igual que las horas que se escriben a mano en la spec 002. Descartado omitirlas: son raras y perderlas sin motivo sería peor. La spec no lo fija: ver Dudas abiertas. Cubre: RF-16.
- D4: Horizonte de un año calculado con el día de la importación (fecha UTC del servidor) más 12 meses, comparando la hora de pared de cada ocurrencia; las repeticiones pasadas de una serie se crean todas. Una serie cuenta como "cortada" si le quedaban ocurrencias después del horizonte. Descartado medir desde el inicio de la serie, porque no es lo que pide la spec. Cubre: RF-22, RF-23, RF-31.
- D5: Crear con **una función SQL `SECURITY INVOKER`**, como `merge_calendars`: el cuerpo de una función es una transacción y RLS sigue aplicando. Descartado insertar desde la acción en varias llamadas (un fallo a medias dejaría un calendario incompleto) y descartada la clave secreta (prohibida en `src/`, P4). Cubre: RF-7, RF-30.
- D6: Descarga con `node:https` y una función `lookup` propia que valida la dirección **en el momento de conectar**, con redirecciones manuales (máximo 3, cada una revalidada), solo puerto 443, 15 s y lectura cortada a 2 MB. Descartado `fetch` con una comprobación de DNS previa: entre comprobar y conectar el nombre puede resolver a otra IP (DNS rebinding). Cubre: RF-1, RF-4, RF-5, RF-26.
- D7: Server Action con `FormData` (enlace o archivo) y `bodySizeLimit` de 3 MB. Descartado un Route Handler (rompe el patrón `useActionState` de las specs 002 y 003) y descartado subir el archivo a Supabase Storage (otro servicio y guardaría el archivo, contra RF-6). Los archivos de más de 3 MB los rechaza Next antes de llegar a la acción, así que el formulario también comprueba el tamaño en el navegador; el servidor sigue siendo quien decide. Cubre: RF-2, RF-6, RF-26.
- D8: El recuento para RF-27 se hace sobre los eventos ya convertidos y la expansión sigue contando hasta un tope de 20.000 para poder decir cuántos eventos "habría producido"; pasado el tope el mensaje dice "más de 20.000". Descartado cortar al llegar a 2.001, porque no se podría informar del total. Se comprobó que expandir 5.000 ocurrencias tarda decenas de milisegundos. Cubre: RF-27.
- D9: La acción devuelve el resumen en el estado y no redirige. Descartado redirigir al calendario: la spec pide mostrar creados, omitidos y series cortadas y ofrecer abrirlo. Cubre: RF-31.
- D10: El nombre por defecto es `X-WR-CALNAME` del `.ics` (recortado a 50) o "Calendario importado". Descartado el `PRODID` o el nombre del archivo: no es un nombre pensado para personas. Cubre: RF-8, RF-9.
- D11: Los textos se limpian de caracteres que Postgres no acepta (el carácter nulo y los sustitutos sueltos de UTF-16) antes de recortar. Descartado dejar que la base de datos falle: tiraría toda la importación por un evento (RF-30). Cubre: RF-13, RF-15.
- D12: `maxDuration` de 60 s en la página del formulario (es la que aplica a su Server Action) para que el límite de 30 s del requisito no dependa del valor por defecto de la plataforma. Descartado dejarlo por defecto, porque Hobby no lo garantiza. Cubre: requisito no funcional de rendimiento.
- D13: Un solo envío de los eventos en una llamada `rpc` con `jsonb`; el límite de 2 MB y 2.000 eventos lo mantiene por debajo de unos pocos MB. Descartado partirlo en bloques: obligaría a dejar de ser una única transacción. Cubre: RF-30.

## Trazabilidad RF -> módulo

| RF | Módulos |
|----|---------|
| RF-1 | `fetch-ics`, `importCalendar`, `import-form` |
| RF-2 | `read-source`, `importCalendar`, `import-form` |
| RF-3 | `source-url` |
| RF-4 | `source-url`, `ip-guard`, `fetch-ics`, `error-messages` |
| RF-5 | `fetch-ics`, `limits`, `error-messages` |
| RF-6 | `fetch-ics`, `importCalendar` (sin persistencia), `error-messages` |
| RF-7 | `import_calendar`, `importCalendar` |
| RF-8 | `schemas`, `importCalendar`, `import-form` |
| RF-9 | `parse-ics` (nombre del calendario), `import-calendar`, `importCalendar` |
| RF-10 | `schemas`, `import-form` |
| RF-11 | `import_calendar` (sin columnas ni tablas de origen) |
| RF-12 | `import_calendar` (sin deduplicación) |
| RF-13 | `parse-ics`, `convert-events` |
| RF-14 | `convert-events` |
| RF-15 | `convert-events` |
| RF-16 | `convert-events` (zona de cada evento) |
| RF-17 | `convert-events` (día completo) |
| RF-18 | `convert-events` |
| RF-19 | `convert-events` |
| RF-20 | `parse-ics` |
| RF-21 | `convert-events` (zonas desconocidas) |
| RF-22 | `parse-ics` |
| RF-23 | `parse-ics`, `limits` |
| RF-24 | `parse-ics` |
| RF-25 | `parse-ics` |
| RF-26 | `limits`, `read-source`, `fetch-ics`, `import-form`, `next.config.ts` |
| RF-27 | `import-calendar`, `limits`, `import_calendar` (defensa), `error-messages` |
| RF-28 | `parse-ics`, `import-calendar`, `error-messages` |
| RF-29 | `convert-events`, `import-calendar` |
| RF-30 | `import_calendar` (transacción), `error-messages` |
| RF-31 | `import-summary`, `importCalendar` |
| RF-32 | `import-form`, página `/dashboard/import` |
| RF-33 | página `/dashboard/import`, `dashboard/page.tsx` |
| RF-34 | `route-access` y proxy existentes (`/dashboard/*`) |

## Riesgos y mitigaciones

- R1: **Descarga de URLs arbitrarias desde el servidor (SSRF).** Mitigación: solo `https` y puerto 443, validación de la IP al conectar, redirecciones revalidadas y limitadas, 15 s, 2 MB, requiere sesión. Tests de `ip-guard` con IPv4 e IPv6 privadas, la dirección de metadatos y direcciones IPv4 mapeadas.
- R2: **La importación no cabe en el tiempo de la función.** Mitigación: `maxDuration` de 60 s, límite bajado a 2.000 eventos (decidido en la spec) y medición en el despliegue con un archivo en el límite. Si no cabe, se baja el límite otra vez, no se alarga la espera.
- R3: **`maxDuration` junto a `cacheComponents`.** Mitigación: el build lo dirá en la primera tarea que lo toque; si no se admite, la alternativa es fijarlo en el `vercel.json` para la ruta.
- R4: **Cuerpo de la petición.** Los 2 MB de archivo más el multipart quedan por debajo de los 3 MB configurados y del límite de cuerpo de las funciones de Vercel. Mitigación: comprobación en el navegador y mensaje del servidor.
- R5: **Series raras** (reglas imposibles o de alta frecuencia). Mitigación: el recuento se corta en el tope de 20.000 y se comprobó que `ical.js` no se queda en bucle; test con `FREQ=SECONDLY` y con una regla que nunca coincide.
- R6: **Horario de verano** (horas que no existen o se repiten). Mitigación: `zonedLocalToUtc` ya resuelve esos casos en la spec 002; tests con una serie que cruza el cambio de hora.
- R7: **Outlook y nombres de zona de Windows**: muchos eventos de Outlook se omitirán (RF-21). Mitigación: el resumen dice cuántos; es una decisión de la spec.
- R8: **Carga útil grande hacia Supabase** (2.000 eventos con descripciones largas). Mitigación: límites de texto de la spec 002 recortan cada campo; prueba de integración con 2.000 eventos de tamaño máximo.
- R9: **Licencia MPL-2.0** de `ical.js`: copyleft a nivel de archivo. Mitigación: no se modifica la librería y el repositorio es privado y de uso personal.
- R10: **`test:db` es intermitente** (conocido): repetir antes de investigar.

## Dudas abiertas

- Ninguna pendiente. Quedan aprobadas junto con el plan: la dependencia `ical.js` 2.2.1 (D1, P6), la interpretación de la hora flotante en la zona del perfil (D3) y el recuento hasta 20.000 con el mensaje "más de 20.000" (D8).
