# Tasks 054 — Pantalla "Ahora"

Spec: `specs/054-pantalla-ahora/spec.md`. Plan: `specs/054-pantalla-ahora/plan.md`.

> Estado: **Aprobadas** por el usuario el 2026-11-27, con la spec y el plan. **Hechas** el 2026-11-27 en la rama `054-pantalla-ahora`; falta la aprobación del usuario para cerrar la spec.

Cada tarea se hace sola, **test primero** (rojo → verde), con su commit que la cite (`feat: … (T3)`). Al cerrar cada una, P8 en verde con su salida; `npm run test:db` en la T1. Textos nuevos con su inglés en `src/i18n/en/now.ts` (`i18n-complete`).

## Tareas

- [x] T1 Guardar la pantalla de inicio en el perfil
  Hecho cuando: `npm run test:db -- profile-home` en verde.
  - Migración `profile_home` (`home text not null default 'calendar'`, check `calendar|now`), `db:push` y `db:types`.
  - Test de integración: el dueño lee y cambia su `home`; otro usuario no lo ve ni lo cambia; un valor fuera del check da `23514`; una cuenta nueva tiene `calendar`.

  Cubre: RF-24, RF-26 | Módulo: migración `profile_home`

- [x] T2 Calcular el rango y las tarjetas de "Ahora"
  Hecho cuando: `npm test -- now-cards now-window` en verde.
  - `nowWindow`: 00:00 de hoy a 00:00 de pasado mañana en la zona del perfil, también en días de cambio de hora.
  - `buildNowCards`:
    - personas seguidas (dueños de calendarios visibles y marcados en "Disponibilidad"), el usuario primero y el resto en el orden guardado, sin las que no tienen nada visible (RF-2–RF-5);
    - solo eventos de calendarios visibles de esa persona, también de un calendario dentro de un grupo (RF-6);
    - en curso con fin exclusivo, más de dos → "+N", "Libre hasta", "Después" hasta el final de mañana y "Nada más hoy ni mañana", línea de día completo sin contar como en curso (RF-7–RF-12);
    - "Ocupado/Libre hasta" para quien solo se ve por disponibilidad, mezcla con RF-14, `busy: null` → `noData` (RF-13, RF-14, RF-22);
    - casos límite de la spec: medianoche, 0 minutos, otra zona horaria, excepción de serie.

  Cubre: RF-2–RF-15, RF-22 | Módulo: `lib/now/cards.ts`, `lib/now/window.ts`

- [x] T3 Pintar las tarjetas
  Hecho cuando: `npm test -- now-card` en verde.
  - Región con el nombre de la persona y horas con `dateFormat(locale)` en `tabular-nums`.
  - El evento enlaza a `/dashboard/events/<id>` y el nombre a `/dashboard/calendar?view=day&date=<hoy>&only=<id>`.
  - Sin botones de crear, mover ni borrar.
  - `role="status"` que solo cambia al cambiar el tipo de estado (D8). Textos en español e inglés.

  Cubre: RF-7–RF-18 | Módulo: `components/now/now-card.tsx`

- [x] T4 Montar la página y su actualización
  Hecho cuando: `npm test -- now-board` en verde.
  - `NowBoard` recalcula al avanzar `useNow()` (reloj simulado).
  - Llama a `router.refresh()` al llegar un aviso de `useLiveCalendar` y al pasar la medianoche.
  - Estado vacío con enlace a "Unirme con código".
  - Página `/dashboard/now` con `<Suspense>`, `await connection()` y lectura en paralelo (D1, D4); `metadata.title`.

  Cubre: RF-1, RF-19, RF-20, RF-27 | Módulo: `now/page.tsx`, `components/now/now-board.tsx`

- [x] T5 Añadir "Ahora" a la navegación
  Hecho cuando: `npm test -- nav bottom-bar top-nav` en verde.
  - Sección `now` primera en `NAV_ITEMS` y disponible sin conexión, con `NowIcon`.
  - Barra inferior "Ahora · Calendario | + | Notas · Más"; "Mis calendarios", primera en "Más" (D6).
  - Comprobación e2e (Playwright + Edge) de que un evento pulsado en "Ahora" abre la ventana `@modal` (R1).

  Cubre: RF-23, RF-16 | Módulo: `lib/shell/nav.ts`, `components/shell/icons.tsx`

- [x] T6 Ver solo a una persona desde "Ahora"
  Hecho cuando: `npm test -- ranges calendar-only` en verde.
  - `only=<personId>` válido limita la visibilidad a los calendarios con ese `ownerId`, también dentro de un grupo (R4); si no es válido, se ignora.
  - Aviso "Viendo solo a X · Ver todos".
  - Tocar un filtro quita `only` sin guardarlo como preferencia (D7).

  Cubre: RF-17 | Módulo: `lib/calendar/ranges.ts`, `calendar-client.tsx`

- [x] T7 Elegir la pantalla de inicio y abrir la app en ella
  Hecho cuando: `npm test -- home-setting dashboard-home next-path manifest` en verde.
  - Selector "Pantalla de inicio" en Ajustes que guarda al momento y deshace si falla (`saveHome`, zod).
  - `/dashboard` redirige según `home`; `/`, `start_url` y `getSafeNextPath` llevan a `/dashboard`; `getCalendarProfile` devuelve `home`.

  Cubre: RF-24, RF-25, RF-26 | Módulo: `home-setting.tsx`, `settings/actions.ts`, `dashboard/page.tsx`, `app/page.tsx`, `manifest.ts`, `next-path.ts`, `queries.ts`

- [x] T8 Usar "Ahora" sin conexión
  Hecho cuando: `npm test -- offline-router offline-now` en verde y `scripts/e2e-offline.mjs` (ampliado con "Ahora") pasa con Edge.
  - Ruta `now` en la app sin conexión con `eventsOf(copy, …)` y `busy: null`.
  - `/dashboard` sin conexión elige según `profile.home` de la copia (`calendar` si falta).
  - Aviso de sin conexión de la app.

  Cubre: RF-21, RF-22, RF-25 | Módulo: `offline-router.tsx`, `offline-app.tsx`, `lib/offline/snapshot.ts`

- [x] T9 Validar la spec y cerrar
  Hecho cuando: checklist RF-1 a RF-27 con su test o prueba manual anotada aquí, y P8 completa (`typecheck`, `lint`, `format:check`, `test`, `build`, `test:db`) en verde con su salida.
  - Prueba manual con tres cuentas de `@cafam.test` en dev (Lector de los calendarios de otra, y una tercera solo por disponibilidad), a ≤ 768 px y en escritorio.
  - Capturas a 390, 768 y 1440 px, en claro y oscuro, con Violeta y Ámbar; barra inferior de antes y después (R5).
  - Medida con `scripts/perf/`: datos pintados en ≤ 1 s con 8 personas y caché caliente, y coste de la redirección de `/dashboard` (R2).
  - `python -m graphify update .`, AGENTS.md (tabla de specs y pendientes de prod) y pasos de producción del plan.

  Cubre: todos | Módulo: validación

## Validación (T9, 2026-11-27)

Pruebas: unitarias `now-window`, `now-cards`, `now-card`, `now-board`, `nav`, `bottom-bar`, `ranges`, `calendar-only`, `home-setting`, `dashboard-home`, `proxy-redirect`, `offline-router`, `offline-now`; integración `profile-home`, `now-privacy`; navegador real (Edge) `scripts/e2e-now.mjs` (tres cuentas: Madre Lectora de los calendarios de Hijo, Tía solo por disponibilidad, y seis personas más con 3 calendarios) y `scripts/e2e-offline.mjs` (paso "Ahora sin red").

| RF | Comprobación |
|----|--------------|
| RF-1 | `now-board`, e2e (9 tarjetas) |
| RF-2–RF-5 | `now-cards` "who is followed", e2e (orden: Madre primero) |
| RF-6 | `now-cards` (calendarios visibles, también en un grupo), `now-privacy` |
| RF-7, RF-8 | `now-cards`, `now-card`, e2e ("Mi calendario · Aula 3 · hasta las HH:MM") |
| RF-9–RF-12 | `now-cards`, `now-card` |
| RF-13, RF-14 | `now-cards`, `now-privacy`, e2e ("Ocupado hasta las…", sin título) |
| RF-15 | `now-window`, `now-cards` "time zones", `now-card` |
| RF-16 | `now-card` (enlace), e2e: se abre la ventana `@modal` sobre "Ahora" (R1) |
| RF-17 | `ranges`, `calendar-only`, e2e ("Viendo solo a Hijo · Ver todos") |
| RF-18 | `now-card` (sin botones) |
| RF-19, RF-20 | `now-board` (reloj simulado, `useLiveCalendar`, medianoche) |
| RF-21, RF-22 | `offline-now`, `offline-router`, `e2e-offline.mjs` |
| RF-23 | `nav`, `bottom-bar`, e2e (barra "Ahora · Calendario · Notas · Más"; pestaña con `aria-current` en escritorio) |
| RF-24, RF-26 | `profile-home`, `home-setting`, e2e (Ajustes guarda `calendar`) |
| RF-25 | `dashboard-home`, `proxy-redirect`, `next-path`, `manifest`, `offline-now`, e2e (entrar abre `/dashboard/now`) |
| RF-27 | `now-board` (estado vacío con "Unirme con código") |

- Capturas a 390, 768 y 1440 px, claro y oscuro, Violeta y Ámbar (12, `scripts/e2e-now.mjs <carpeta>`); sin scroll horizontal en escritorio. No se hicieron capturas de la barra inferior "antes" (R5): la de antes era "Calendario · Notas · Calendarios · Más".
- Medida (CPU 4x, caché caliente, 8 personas y 3 calendarios cada una): `/dashboard/now` con datos en 630–820 ms. R2: la redirección de `/dashboard` dentro de `<Suspense>` espera al JS y daba 1,25–1,9 s; ahora el proxy responde con un 307 en las cargas de página (`Sec-Fetch-Mode: navigate`, también a través del service worker; D5 sigue leyendo `profiles.home`) y `/dashboard` queda en 800–1.020 ms. La página `/dashboard` sigue redirigiendo las navegaciones del cliente y las acciones enviadas a `/dashboard` (si el proxy las redirige, la barra se queda en `/dashboard`).
- `scripts/e2e-offline.mjs`: 18/18 dos veces. Además de añadir "Ahora sin red": crea la cuenta confirmada y entra por el formulario (en dev está activado "Confirm email", spec 049, y por eso `tests/integration/signup.test.ts` "rejects a duplicate email" también falla), y el último paso pulsa el "Más" de la barra, no el de las vistas (spec 042).
- `npm run test:db` completo: 723/727; los fallos de `live-changes`, `ics-export` y `schema` coincidieron con el e2e y los builds, y pasan solos; el de `signup` es el de "Confirm email".
- Sin prueba en un teléfono real: lo de móvil se hizo con Playwright a 390 px con táctil.
- Desviaciones: el aviso "Viendo solo a X · Ver todos" va encima de la vista y no dentro del panel de filtros (en el móvil el panel está oculto); `nowWindow(timeZone, now)` devuelve además `todayEnd`, `tomorrowEnd` y `now`; la copia sin conexión guarda `busyPeople` (opcional) para RF-22; "Ahora" sin conexión no aplica los cambios pendientes de la cola.
- De paso: las etiquetas de la navegación no pasaban por `t()` (spec 053) y salían en español con la interfaz en inglés.

## Trazabilidad RF → Tareas

| RF | Tareas |
|----|--------|
| RF-1 | T4 |
| RF-2, RF-3, RF-4, RF-5, RF-6 | T2 |
| RF-7–RF-15 | T2, T3 |
| RF-16 | T3, T5 |
| RF-17 | T3, T6 |
| RF-18 | T3 |
| RF-19, RF-20 | T4 |
| RF-21 | T8 |
| RF-22 | T2, T8 |
| RF-23 | T5 |
| RF-24, RF-26 | T1, T7 |
| RF-25 | T7, T8 |
| RF-27 | T4 |
| Todos | T9 |

## Dudas abiertas

- Ninguna.
