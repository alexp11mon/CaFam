# Plan 023 — Auditoría y correcciones

Spec: `specs/023-auditoria-y-correcciones/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-10).

## Resumen de arquitectura

No cambia la arquitectura. Cada corrección va en el módulo compartido donde nace el defecto, no en sus llamadores:

- **Base de datos**: tres migraciones nuevas que vuelven a crear tres funciones (`restore_event`, `assistant_busy`, `join_with_code`) con su comprobación. Sin tablas ni columnas.
- **Servidor**: cabeceras en `next.config.ts`, `robots` en el layout raíz, un comparador de secretos compartido, paginación dentro de `getEventsInRange` y lecturas en paralelo en los cargadores.
- **Lógica pura**: `series-write.ts` y `rule.ts` (series), `drag.ts` (tope del día).
- **Interfaz**: tres archivos de error de Next, y retoques de clases en componentes existentes; la única pieza nueva de interfaz es el enlace "Saltar al contenido" y la prop `hint` de `TextField`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/…_restore_event_guard.sql` | `restore_event` exige que `p_event_id` sea un evento del calendario de la copia (RF-1) |
| `supabase/migrations/…_assistant_busy_scope.sql` | `assistant_busy` con el filtro de `grid_busy` (RF-2) |
| `supabase/migrations/…_join_code_lock.sql` | `join_with_code` toma dos bloqueos de transacción antes de contar (RF-3) |
| `next.config.ts` | Cabeceras globales, declaradas antes que las de `/invite` y `/sw.js` (RF-4) |
| `src/app/layout.tsx` | `robots` (RF-5) |
| `src/lib/auth/cron-secret.ts` (nuevo) | `hasCronSecret(request)`: compara los SHA-256 con `timingSafeEqual` (RF-6) |
| `src/lib/recurrence/rule.ts`, `series-write.ts` | `shiftRule` (regla desplazada con la fecha) y delta en hora de reloj (RF-7, RF-8, RF-9) |
| `src/lib/calendar/drag.ts` | Tope de 23:59 al mover sin cambiar la hora; sin movimiento si no cabe (RF-10, RF-11) |
| `src/app/dashboard/events/actions.ts` | Contar también comentarios al convertir en serie (RF-12) |
| `src/lib/calendar/queries.ts` | `getEventsInRange` pagina sus consultas de 1.000 en 1.000 (RF-13) |
| `load-event.ts`, `card-actions.ts`, `agenda-actions.ts`, `mini-month-actions.ts`, `lib/comments/queries.ts` | `Promise.all` (RF-14, RF-15) |
| `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` (nuevos) | Páginas de error en español (RF-16, RF-17) |
| `src/components/shell/app-frame.tsx`, `nav-drawer.tsx` | Enlace de salto y botón "Cerrar" (RF-18, RF-22) |
| `src/components/calendar/event-modal.tsx`, `view-toolbar.tsx` | Foco en la confirmación y contraste de la tecla (RF-19, RF-23) |
| `src/components/ui/toast.tsx`, `src/lib/calendar/shortcuts.ts` | Ctrl/⌘+Z y su fila en la ayuda (RF-20, RF-21) |
| `src/components/ui/text-field.tsx` y formularios de contraseña | Prop `hint` (RF-24) |
| Páginas y componentes de las pantallas secundarias | Retoques de clases (RF-25 a RF-38) |
| `tests/integration/invites.test.ts`, `.gitignore`, `.prettierignore` | RF-39, RF-40 |

## Modelo de datos

Sin tablas, columnas ni políticas nuevas. Tres funciones se vuelven a crear con `create or replace` en migraciones nuevas, con la misma firma, los mismos permisos y el mismo cuerpo salvo la comprobación añadida. `src/types/database.ts` no debería cambiar; se regenera igualmente.

## Decisiones técnicas

- **D1 — `restore_event` responde `CF404` ante un evento que no es del calendario de la copia.** Es el código que ya usa para "nada que restaurar" y no revela si el evento existe.
- **D2 — `assistant_busy` copia el filtro de `grid_busy`** (`c.owner_id = people.id or e.created_by = people.id`, spec 020 D13) y conserva sus columnas, porque `tools.ts` usa el `id`. Así las dos vías de disponibilidad dan lo mismo y el consentimiento de una persona nunca expone el calendario de un tercero.
- **D3 — `join_with_code` usa `pg_advisory_xact_lock`** por ID y por usuario, en ese orden, en lugar de bloquear filas: el recuento es sobre `join_attempts`, que no tiene una fila que bloquear. Se sueltan solos al acabar la transacción.
- **D4 — `frame-ancestors 'none'` junto a `X-Frame-Options: DENY`.** La app no se enmarca en ningún sitio; las dos cabeceras cubren navegadores viejos y nuevos. Sin CSP de scripts (diferido).
- **D5 — El secreto se compara por su SHA-256** con `crypto.timingSafeEqual`, que exige la misma longitud: hashear antes evita filtrar la longitud y el `throw` por tamaños distintos.
- **D6 — Mover una repetición desplaza la regla, no solo el inicio.** `shiftRule(rule, from, to)`: en semanal, cada día de `byDay` se desplaza la diferencia de días; en mensual por día y anual, la regla toma el día (y el mes) de la fecha nueva; en mensual por posición ("segundo martes"), toma la posición y el día de la fecha nueva. Solo se aplica cuando la regla no cambió y la fecha sí: si el usuario eligió otra regla, manda la suya.
- **D7 — El inicio nuevo de la serie se calcula en hora de reloj** en la zona de la serie: partes locales del inicio de la serie más la diferencia de reloj (días y minutos) entre la repetición original y la editada, convertidas con `zonedLocalToUtc`. En día completo se sigue operando en UTC, que no tiene cambios de hora.
- **D8 — Al mover de día, el tope es 23:59** y no 23:45: la rejilla de 15 minutos solo tiene sentido cuando cambia la hora. Si Alt+↓ no cabe en el día, no hay cambio (la alternativa, cruzar la medianoche con el teclado, es una función nueva).
- **D9 — Convertir en serie con comentarios sigue el camino de las imágenes** (el evento original queda como primera repetición de una serie nueva): ya existe, está probado y conserva imágenes y comentarios en una fila que las repeticiones sí muestran.
- **D10 — `getEventsInRange` pagina dentro** con `.range()` hasta recibir una página incompleta, con un orden estable (`starts_at`, `id`). Los llamadores no cambian. Tope de 20 páginas (20.000 filas) para que un error no haga un bucle.
- **D11 — Las páginas de error calcan `/offline`** (marca, título, texto y botón), fuera del marco del panel: un `not-found` dentro del marco necesitaría sesión y su propio archivo por segmento. `global-error.tsx` lleva su propio `<html>` y estilos mínimos con las variables de `globals.css`.
- **D12 — Ctrl/⌘+Z vive en `ToastProvider`**, que es quien sabe si hay algo que deshacer; nunca actúa si el foco está en un campo de texto (ahí Ctrl+Z es del navegador). Enmienda 9.
- **D13 — El `h1` de las pantallas del panel pasa a `max-tab:sr-only`** en lugar de quitar el título de la cabecera: la cabecera es fija y el `h1` se conserva para los lectores de pantalla (un `h1` por página).
- **D14 — Los retoques visuales son solo de clases**, con tokens y primitivas que ya existen (`Avatar`, `SwapLabel`, `ChevronIcon`, `CloseIcon`, `press`). Ninguna primitiva nueva.
- **D15 — La caducidad de la invitación se compara con `created_at` de la misma fila** (los dos salen del mismo `now()` de la transacción), no con el reloj local.

## Riesgos y mitigaciones

- **R1 — Romper el alcance de las series.** Tests puros nuevos con fechas concretas (miércoles → jueves, verano → invierno) y los de `series-write.test.ts` existentes en verde. Si un caso de regla no se puede desplazar con seguridad (por ejemplo, semanal con varios días y salto de semana), `shiftRule` desplaza todos los días por igual, que es lo que hace Google Calendar.
- **R2 — Las cabeceras rompen algo.** Se comprueba en el navegador que la app carga, que el service worker se registra y que `/invite` conserva `no-referrer`. El OAuth es una redirección de página completa, no un marco.
- **R3 — `assistant_busy` cambia respuestas del asistente.** Solo quita datos de terceros. No se lanza `eval:assistant` (cuota): lo cubre `test:db` y el test unitario de `find_free_time` no cambia.
- **R4 — La paginación duplica o pierde filas** si el orden no es estable: se ordena también por `id`.
- **R5 — Límite de Supabase Auth en `test:db`.** Se ejecuta en serie (`--no-file-parallelism`) y se repite antes de culpar al código.
- **R6 — El `h1` oculto en el móvil deja una pantalla sin título** si la cabecera no lo pinta: se comprueba en cada pantalla a 375 px.

## Estrategia de pruebas

- **Puras (`npm test`)**: `rule` (`shiftRule`), `series-write` (casos H2 y H3), `drag` (23:50), `cron-secret`, `shortcuts`.
- **Componentes (`npm test`)**: páginas de error, enlace de salto, foco de la confirmación, Ctrl+Z en `toast`, botón "Cerrar" del cajón, `hint` de `TextField`, avatar en la lista de miembros.
- **Integración (`npm run test:db`)**: `restore_event` con un evento ajeno, `assistant_busy` con un calendario de un tercero, `join_with_code` (los existentes) e `invites`.
- **Navegador**: cabeceras, páginas de error y las pantallas tocadas a 375 y 1440 px en claro y oscuro.

## Dudas abiertas

Ninguna.
