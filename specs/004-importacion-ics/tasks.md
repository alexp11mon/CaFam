# Tasks 004 - Importación de calendarios .ics

> Estado: **Aprobadas** por el usuario (2026-10-22). Ninguna tarea empezada.
> Spec: `specs/004-importacion-ics/spec.md`. Plan: `specs/004-importacion-ics/plan.md`.
> Reglas: una tarea cada vez, test primero (rojo → verde), y al cerrar cada tarea se ejecuta y reporta el checklist de "Verificación obligatoria" de la constitución (P7, P8): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` si toca esquema, RLS o acceso a datos, y prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Un commit por tarea citándola, en la rama `004-importacion-ics`.
> La única dependencia nueva es `ical.js` 2.2.1 (aprobada en el plan, D1) y se instala en T4; ninguna otra tarea toca `package.json`. Las páginas siguen el patrón de las specs 002 y 003 (`page.tsx` síncrono, `revalidatePath("/dashboard", "layout")` tras escribir, campos no controlados con `useId()`). Para las demos manuales se usa `playwright-cli` contra `dev` (ver `AGENTS.md`, sección 10) y los usuarios de prueba se borran al terminar. Los `.ics` de prueba son ficheros sintéticos en `tests/fixtures/ics/`, nunca calendarios reales de nadie.

## Tareas

- [x] T1 Crear la migración de `import_calendar` con su test de base de datos
  Pasos: test primero en `tests/integration/import-calendar.test.ts` con un usuario y `anon`: crea un calendario del llamante con su fila `owner` y los eventos del `jsonb` (título, descripción, lugar, instantes y `all_day`, con `created_by` = el llamante); usa el azul de marca si el color es nulo; dos llamadas iguales crean dos calendarios distintos (sin deduplicar); rechaza con `22023` un `p_events` que no sea un array, vacío o de más de 2.000 elementos; si un solo evento viola una restricción de `events` (por ejemplo `ends_at` anterior a `starts_at`) no queda ni el calendario ni ningún evento; no deja ninguna columna ni tabla de origen (el calendario creado tiene exactamente las columnas de siempre); `anon` no puede llamarla. Migración `supabase/migrations/<timestamp>_import_calendar.sql` (`SECURITY INVOKER`, `search_path = ''`, revocada a `public` y `anon`); comprobar antes que el link apunta a `dev`, `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- import-calendar schema rls` en verde y `src/types/database.ts` contiene `import_calendar`. Cubre: RF-7, RF-11, RF-12, RF-27, RF-30 | Módulo: SQL (`import_calendar`)

- [x] T2 Implementar los límites, la validación del enlace y el filtro de IP como lógica pura
  Pasos: tests primero en `tests/unit/ics-source-url.test.ts` (acepta `https://…` y `webcal://…` convirtiéndolo a `https://`; rechaza `http://`, `ftp://`, `file://`, `javascript:`, puertos distintos de 443, usuario y contraseña en la URL, vacío y texto que no es URL; rechaza IPs privadas escritas a mano como `https://10.0.0.1/a.ics` y `https://[::1]/a.ics`) y `tests/unit/ics-ip-guard.test.ts` (rechaza loopback, `10/8`, `172.16/12`, `192.168/16`, enlace local `169.254/16` incluida la dirección de metadatos, CGNAT `100.64/10`, `0.0.0.0`, multicast, `::1`, `fc00::/7`, `fe80::/10` y IPv4 mapeadas a IPv6 como `::ffff:10.0.0.1`; acepta direcciones públicas v4 y v6); módulos `src/lib/ics/limits.ts` (2 MB, 2.000 eventos, 12 meses, 15 s, 3 redirecciones y tope de recuento de 20.000), `source-url.ts` e `ip-guard.ts`.
  Hecho cuando: `npm test -- ics-source-url ics-ip-guard` en verde y `package.json` sin dependencias nuevas. Cubre: RF-3, RF-4, RF-5, RF-23, RF-26, RF-27 | Módulo: ics/limits, ics/source-url, ics/ip-guard

- [x] T3 Implementar la descarga segura del enlace
  Pasos: test primero en `tests/unit/ics-fetch.test.ts` (entorno `node`, con una función de transporte y de resolución DNS inyectadas, sin red real): devuelve el texto de una respuesta 200; la validación de la IP se ejecuta al conectar y una IP privada da error de enlace no válido; sigue hasta 3 redirecciones revalidando la URL y la IP de cada una y la cuarta da error; una redirección a `http://` o a un puerto distinto da error; una respuesta 404 o 500, un fallo de red y la espera de más de 15 s (con temporizadores simulados) dan error "no se pudo leer"; corta la lectura al pasar de 2 MB sin esperar al final del cuerpo; ningún mensaje de error contiene la URL; no escribe nada en disco ni en base de datos. Módulo `src/lib/ics/fetch-ics.ts` con `node:https`, función `lookup` propia y redirecciones manuales.
  Hecho cuando: `npm test -- ics-fetch` en verde y `tests/unit/no-secrets.test.ts` sigue en verde. Cubre: RF-1, RF-4, RF-5, RF-6, RF-26 | Módulo: ics/fetch-ics

- [x] T4 Instalar `ical.js` e implementar la lectura del .ics con sus repeticiones
  Pasos: `npm install ical.js@2.2.1` (aprobada en el plan, D1; es la única modificación de `package.json` de la spec). Tests primero en `tests/unit/ics-parse.test.ts` con `.ics` escritos en el propio test: devuelve el `X-WR-CALNAME` o `null`; lee título, descripción, lugar, inicio y fin como campos de calendario con su `TZID` (o `utc`, o ninguna) y si es de día completo; omite los eventos `STATUS:CANCELLED`; una serie semanal crea una ocurrencia por repetición; respeta `EXDATE`; una repetición con `RECURRENCE-ID` sustituye a la original (otro día, otra hora, otro título); una serie sin fin se corta un año después del día dado y cuenta una serie cortada; una serie que termina antes del horizonte se importa completa, incluidas las repeticiones pasadas; `FREQ=SECONDLY` y una regla que nunca coincide no se quedan en bucle y respetan el tope de 20.000; una repetición de día completo se expande por días; texto que no es un `.ics` da `not-ics` y un `.ics` sin eventos da `no-events`. Módulo `src/lib/ics/parse-ics.ts`, el único que importa `ical.js`.
  Hecho cuando: `npm test -- ics-parse` en verde y `package.json` solo añade `ical.js` 2.2.1 (comprobado con `git diff package.json`). Cubre: RF-9, RF-13, RF-20, RF-22, RF-23, RF-24, RF-25, RF-28 | Módulo: ics/parse-ics

- [x] T5 Implementar la conversión de ocurrencias a eventos
  Pasos: test primero en `tests/unit/ics-convert.test.ts`: un evento con `TZID=Europe/Madrid` se guarda como el instante UTC correcto (y una serie semanal que cruza el cambio de hora sigue a las 10:00 locales); `Z` se guarda tal cual; una hora sin zona ni `Z` se interpreta en la zona del perfil; una zona no reconocida (por ejemplo `Romance Standard Time`) omite el evento y suma uno a omitidos; un día completo se guarda con la convención de la spec 002 (inicio 00:00 UTC y fin exclusivo) y uno de varios días sigue siendo un solo evento; sin fin, dura cero si tiene hora y un día si es de día completo; un fin anterior al inicio omite el evento; título vacío da "(Sin título)"; título, descripción y lugar se recortan a 100, 2000 y 200 y se limpian el carácter nulo y los sustitutos sueltos; las filas devueltas tienen la forma que espera `import_calendar`. Módulo `src/lib/ics/convert-events.ts` (reutiliza `calendar/time-zone.ts`).
  Hecho cuando: `npm test -- ics-convert` en verde. Cubre: RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-21, RF-29 | Módulo: ics/convert-events

- [x] T6 Implementar el formulario validado, los mensajes de error y la lectura del archivo
  Pasos: tests primero en `tests/unit/ics-schemas.test.ts` (nombre opcional de 0 a 50 caracteres con error "Escribe un nombre de 1 a 50 caracteres." si pasa de 50; color de la paleta o vacío; exactamente uno de enlace o archivo, con el error "Indica un enlace o sube un archivo, no los dos." si faltan ambos o llegan ambos), `tests/unit/ics-error-messages.test.ts` (cada fallo da su mensaje en español, incluido el de más de 2.000 eventos con el recuento y "más de 20.000" pasado el tope, y ninguno contiene el enlace) y `tests/unit/ics-read-source.test.ts` (lee el texto de un archivo de hasta 2 MB; un archivo de 2 MB y un byte da "demasiado grande"; elige archivo o enlace según el formulario). Módulos `src/lib/ics/schemas.ts`, `error-messages.ts` y `read-source.ts`.
  Hecho cuando: `npm test -- ics-schemas ics-error-messages ics-read-source` en verde. Cubre: RF-2, RF-4, RF-5, RF-8, RF-10, RF-26, RF-27, RF-28 | Módulo: ics/schemas, ics/error-messages, ics/read-source

- [x] T7 Orquestar origen, lectura y conversión con los límites de eventos
  Pasos: test primero en `tests/unit/ics-import-calendar.test.ts` (sin red ni base de datos, con la descarga y la fecha de hoy inyectadas): un `.ics` válido da nombre, eventos, omitidos y series cortadas; el nombre por defecto es el del `.ics` recortado a 50 caracteres o "Calendario importado"; más de 2.000 eventos ya convertidos da el error con el recuento real hasta 20.000 y "más de 20.000" después, y no devuelve eventos; los omitidos no cuentan para el límite; si todos los eventos se omiten da "sin eventos importables"; un `.ics` inválido da "no es un .ics"; los errores de descarga y de tamaño se propagan con su mensaje. Módulo `src/lib/ics/import-calendar.ts` (`runImport`).
  Hecho cuando: `npm test -- ics-import-calendar` en verde. Cubre: RF-9, RF-27, RF-28, RF-29 | Módulo: ics/import-calendar

- [ ] T8 Implementar la Server Action `importCalendar` y la configuración del tamaño del cuerpo
  Pasos: tests primero en `tests/unit/import-action.test.ts` (entorno `node`, mockea la sesión, la zona del perfil, `runImport` y `rpc`): con éxito llama a `import_calendar` con el nombre, el color (azul de marca si no se elige) y los eventos, llama a `revalidatePath("/dashboard", "layout")` y devuelve el resumen (creados, omitidos, series cortadas, id del calendario) sin redirigir; si `runImport` o el `rpc` fallan devuelve el mensaje y no revalida; el error de base de datos da "No se ha podido crear el calendario. No se ha guardado nada."; ningún estado devuelto contiene el enlace ni el texto del `.ics`; la zona horaria sale del perfil leído en el servidor, nunca del formulario. Ampliar `tests/unit/next-config-headers.test.ts` (`serverActions.bodySizeLimit` de 3 MB y las cabeceras existentes intactas). Módulo `src/app/dashboard/import/actions.ts` y cambio en `next.config.ts`.
  Hecho cuando: `npm test -- import-action next-config-headers` en verde y `npm run build` en verde. Cubre: RF-1, RF-2, RF-6, RF-7, RF-8, RF-26, RF-30, RF-31 | Módulo: import/actions, next.config

- [ ] T9 Implementar el formulario de importación, el resumen, la página y el acceso del panel
  Pasos: tests primero en `tests/unit/import-form.test.tsx` (campos enlace, archivo, nombre y color; errores junto al campo y como alerta; botón deshabilitado con "Importando…" mientras trabaja; un archivo de más de 2 MB muestra el mensaje antes de enviar; lo escrito se conserva tras un error) y `tests/unit/import-summary.test.tsx` (creados, omitidos y series cortadas, y enlace para abrir el calendario nuevo; sin omitidos ni cortes no muestra esas líneas); componentes `src/components/import/import-form.tsx` e `import-summary.tsx` (reutilizan `ColorPicker`, `TextField` y `FormAlert`), página `src/app/dashboard/import/page.tsx` síncrona con `maxDuration` de 60, y el botón "Importar calendario" en `src/app/dashboard/page.tsx`.
  Hecho cuando: `npm test -- import-form import-summary` en verde, `npm run build` en verde y demo manual en móvil y escritorio: sin sesión `/dashboard/import` lleva a `/login`; con sesión se importa un `.ics` de prueba por archivo y otro por enlace, se ve el resumen, el calendario aparece en el panel y en las vistas, y no hay scroll horizontal entre 360 y 1920 px. Cubre: RF-8, RF-10, RF-26, RF-31, RF-32, RF-33, RF-34 | Módulo: import-form, import-summary, /dashboard/import, dashboard/page

- [ ] T10 Probar la importación completa con ficheros de ejemplo, el tamaño máximo y el tiempo
  Pasos: añadir `tests/fixtures/ics/` con tres `.ics` sintéticos al estilo de Google (UTC y `TZID` IANA, series con `EXDATE` y `RECURRENCE-ID`), iCloud (días completos y series anuales) y Outlook (zonas de Windows y eventos cancelados), y un `.ics` generado en el test con 2.000 eventos de título, descripción y lugar de tamaño máximo. Test primero en `tests/integration/import-fixtures.test.ts` contra `dev`: cada fichero pasa por `runImport` y por `import_calendar` con un usuario de prueba, y los eventos guardados coinciden con lo esperado (instantes, día completo, repeticiones, omitidos de Outlook); el calendario resultante es editable (el propietario actualiza y borra un evento importado y un Editor añadido con la spec 003 puede crear otro); importar dos veces da dos calendarios; el de 2.000 eventos máximos se guarda entero y el de 2.001 se rechaza sin crear nada; la importación del de 2.000 eventos (sin contar la descarga) termina en menos de 30 segundos.
  Hecho cuando: `npm run test:db -- import-fixtures import-calendar` en verde con el tiempo del caso máximo reportado en la salida. Cubre: RF-12, RF-13, RF-16, RF-27, requisito de rendimiento | Módulo: validación (ics/*, import_calendar)

- [ ] T11 Validar la spec en producción, cobertura RF por RF y fuera de alcance
  Pasos: completar la tabla RF → tarea → test con evidencia en este archivo; comprobar que no hay nada de "Fuera de alcance" (sin sincronización ni botón "Actualizar", sin guardar el enlace ni el archivo, sin importar a un calendario existente, sin exportar, sin dependencias nuevas aparte de `ical.js`); medir en el despliegue (Vercel) la importación de un `.ics` de 2.000 eventos y comprobar que cabe en 30 s (si no cabe, bajar el límite y avisar al usuario); actualizar `AGENTS.md` (estado, rutas, esquema, estructura y trampas aprendidas, incluida la dependencia `ical.js` en la sección 4) y preparar al usuario los comandos para aplicar la migración a prod y volver a enlazar `dev` (los ejecuta él, con `!`).
  Hecho cuando: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:db && npm run build` en verde con la salida reportada, migración aplicada por el usuario en prod, demo manual en producción con un `.ics` real de Google, otro de iCloud y otro de Outlook por enlace y por archivo (ver el calendario, editar un evento y compartirlo con otra cuenta), los errores (enlace no válido, archivo que no es `.ics`, archivo por encima de los límites) y aprobación explícita del usuario para cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T3, T8
- RF-2 -> T6, T8
- RF-3 -> T2
- RF-4 -> T2, T3, T6
- RF-5 -> T2, T3, T6
- RF-6 -> T3, T8
- RF-7 -> T1, T8
- RF-8 -> T6, T8, T9
- RF-9 -> T4, T7
- RF-10 -> T6, T9
- RF-11 -> T1
- RF-12 -> T1, T10
- RF-13 -> T4, T5, T10
- RF-14 -> T5
- RF-15 -> T5
- RF-16 -> T5, T10
- RF-17 -> T5
- RF-18 -> T5
- RF-19 -> T5
- RF-20 -> T4
- RF-21 -> T5
- RF-22 -> T4
- RF-23 -> T2, T4
- RF-24 -> T4
- RF-25 -> T4
- RF-26 -> T2, T3, T6, T8, T9
- RF-27 -> T1, T2, T6, T7, T10
- RF-28 -> T4, T6, T7
- RF-29 -> T5, T7
- RF-30 -> T1, T8
- RF-31 -> T8, T9
- RF-32 -> T9
- RF-33 -> T9
- RF-34 -> T9
- RNF (privacidad, seguridad, rendimiento, coste cero, mobile-first, accesibilidad) -> T3, T9, T10, T11

## Dudas abiertas

- Ninguna pendiente. El plan está aprobado y no deja `[NECESITA ACLARACIÓN]`.
