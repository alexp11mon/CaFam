# Plan 020 — Disponibilidad en el calendario y sincronización rápida

Spec de origen: `specs/020-disponibilidad-y-sincronizacion-rapida/spec.md`, aprobada por el usuario el 2026-11-08. Constitución: `docs/constitution.md`.

> Estado: **Aprobado** por el usuario el 2026-11-08.

Sin dependencias nuevas (P6) ni enmiendas: los avisos de Google son la API de Calendar que ya se usa (`fetch`, `providers/google.ts`) y la comprobación de iCloud es un `PROPFIND` de `tsdav`, que ya está instalado.

## Resumen de arquitectura

- **Disponibilidad (lectura).** Una función `SECURITY DEFINER` nueva, `grid_busy(p_from, p_to)`, devuelve solo horarios de las personas que el usuario marcó, que consienten y con las que comparte calendario: sin ids, títulos ni calendarios. El servidor expande las repeticiones con el `expandRows` de la 013, quita lo que coincide con eventos que el usuario ya ve, junta los intervalos por persona y pasa a las vistas semana y día una lista de bloques `{persona, inicio, fin}`. El navegador nunca recibe otra cosa.
- **Consentimiento y elección.** Una columna nueva en `profiles` (`share_busy`) para el consentimiento y otra en `person_preferences` (`show_busy`) para las personas marcadas: las dos tablas ya son privadas por RLS.
- **Sincronización rápida.** Un solo motor (el de la 007) con tres cambios: el cron pasa de cada hora a **cada minuto** (solo llama a Vercel si hay trabajo); un calendario "toca" cada 15 minutos y además en cuanto llega un aviso de Google; y antes de leer todos los eventos se pide al proveedor una **versión** barata del calendario (Google: `updated` de la lista de eventos; iCloud: `getctag`). Si no cambió, no se descarga nada. Los avisos de Google llegan a una ruta pública que solo marca el calendario como pendiente.

```
Google ── aviso (X-Goog-Channel-ID/Token) ──▶ POST /api/sync/google-push ──▶ sync_push(secreto, canal, token) ──▶ synced_calendars.push_pending_at
                                                  └ responde 200 siempre (válido o falso)
pg_cron cada minuto ─▶ sync_trigger(): ¿hay pendientes (aviso, 15 min, canal por renovar o cancelar)? ─ sí ─▶ POST /api/sync/run
/api/sync/run ─▶ sync_claim_due ─▶ por calendario:
        ├ ¿canal de Google ausente o caduca en < 24 h? ─▶ watch (y stop del viejo) ─▶ sync_store_channel
        ├ versión = provider.calendarVersion() ─ igual, sin aviso y lectura completa < 6 h ─▶ sync_mark_checked (sin descargar)
        └ distinta, aviso o > 6 h ─▶ listEvents ─▶ sync_apply_events (como hoy) ─▶ sync_mark_checked(versión)
        └ cola de canales a cancelar ─▶ channels.stop

Página del calendario (semana o día) ─▶ getEventsInRange (como hoy) + getBusyBlocks(periodo) ─▶ grid_busy ─▶ expandRows ─▶ quitar coincidencias ─▶ juntar ─▶ BusyBlock
```

## Módulos y responsabilidades

### Disponibilidad

- **Migración `busy_grid`**: `profiles.share_busy`, `person_preferences.show_busy`, `busy_people()` y `grid_busy()`. No toca `assistant_busy` ni `share_availability`. Cubre: RF-1, RF-2, RF-5, RF-7, RF-10, RF-17, RF-18.
- **`lib/availability/busy.ts`** (puro y testeado): de las filas de `grid_busy` ya expandidas y los eventos visibles, quita los intervalos que coinciden exactamente con uno visible, separa los de día completo y junta por persona los que se solapan o se tocan. No lee la base de datos. Cubre: RF-10, RF-11, RF-12, RF-13.
- **`lib/availability/queries.ts`**: `getBusyPeople()` (personas de la sección) y `getBusyBlocks(range, visibles)` (llama a `grid_busy`, expande con `expandRows` y usa `busy.ts`). Solo servidor. Cubre: RF-5, RF-8, RF-10, RF-18.
- **`app/dashboard/settings/actions.ts`**: `setShareBusy(on)`. **`app/dashboard/calendar/preferences-actions.ts`**: `setShowBusy(personId, on)` (upsert parcial de `person_preferences`, como el orden de personas). Cubre: RF-1, RF-4, RF-6, RF-7.
- **`components/settings/busy-setting.tsx`**: la opción con `Switch` y su explicación, junto a `AvailabilitySetting`. Cubre: RF-1, RF-2, RF-3.
- **`components/calendar/calendar-filters.tsx`**: sección "Disponibilidad" con una casilla por persona (avatar e iniciales). No aparece si no hay nadie. Cubre: RF-5, RF-6, RF-17.
- **`components/calendar/busy-block.tsx`**: el bloque "Ocupado · nombre" en la rejilla y en la franja de día completo; un botón que abre un globo (`pop`, posición con `placePopover`) con el nombre y las horas. No es `DraggableEvent`, no lleva `data-event-id` ni menú. Cubre: RF-9, RF-11, RF-14, RF-15.
- **`components/calendar/time-grid.tsx`** y vistas semana y día: reciben `busy` y lo colocan con `layoutTimedDay` junto a los eventos. Mes y agenda no lo reciben. Cubre: RF-8, RF-16.
- **`/privacy`**: párrafo nuevo en "Calendarios compartidos". Cubre: NFR privacidad.

### Sincronización rápida

- **Migración `sync_fast`**: columnas nuevas en `synced_calendars`, tablas `sync_channels` y `sync_channel_stops`, funciones `sync_push`, `sync_store_channel`, `sync_mark_checked`, `sync_claim_stops`, `sync_done_stop`, cambios en `sync_due_calendars`, `sync_claim_due`, `sync_trigger` y `connect_account`, y el cron cada minuto. Cubre: RF-19 a RF-28.
- **`lib/sync/providers/types.ts`**: dos métodos nuevos en `ProviderSession`: `calendarVersion(calendarId)` y, solo en Google, `watchCalendar` y `stopChannel` (opcionales: iCloud no los tiene). Cubre: RF-20, RF-22, RF-27.
- **`lib/sync/providers/google.ts`**: `calendarVersion` (`events?maxResults=1&fields=updated`), `watchCalendar` (`POST .../events/watch`) y `stopChannel` (`POST /channels/stop`). Sigue siendo el único cliente HTTP de Google. Cubre: RF-19, RF-20, RF-22.
- **`lib/sync/providers/icloud.ts`**: `calendarVersion` con un `PROPFIND` de profundidad 0 a `cs:getctag`. Cubre: RF-26, RF-27.
- **`lib/sync/run-sync.ts`**: `syncOne` decide si basta la versión o hay que leer todo (`needsFullRead`, pura y testeada), renueva el canal de Google si hace falta y procesa la cola de cancelaciones. Los fallos van por `sync_fail` como hoy. Cubre: RF-20, RF-22, RF-23, RF-26 a RF-29.
- **`lib/sync/channel.ts`** (puro y testeado): genera id y token del canal, decide si renovar (caduca en menos de 24 h) y lee las cabeceras de un aviso. Cubre: RF-20, RF-21.
- **`app/api/sync/google-push/route.ts`**: ruta pública `POST` que lee `X-Goog-Channel-ID`, `X-Goog-Channel-Token` y `X-Goog-Resource-State`, llama a `sync_push` y responde siempre `200` vacío. No lee el cuerpo. Cubre: RF-19, RF-21, RF-24, NFR seguridad.
- **`lib/sync/limits.ts`**: `POLL_MINUTES = 15`, `PUSH_DEBOUNCE_MS = 60_000`, `FULL_READ_HOURS = 6`, `CHANNEL_RENEW_HOURS = 24`, `CHANNEL_TTL_DAYS = 7`. Cubre: RF-23, RF-24, RF-26.

## Modelo de datos

### Disponibilidad (migración `busy_grid`)

- `profiles.share_busy boolean not null default false`. Protegida por las políticas de `profiles` (solo el propio). `visible_people()`, `calendar_members_with_names` y `assistant_people()` no la exponen.
- `person_preferences.show_busy boolean not null default false`. Ya es privada (solo su dueño). Un upsert parcial conserva `position`.
- `busy_people()` (`SECURITY DEFINER`, `search_path = ''`): `id`, `display_name` y `shown` de las personas con `share_busy` que comparten algún calendario con `auth.uid()` (sin el propio usuario). Una cuenta borrada desaparece sola (su perfil ya no existe).
- `grid_busy(p_from, p_to)` (`SECURITY DEFINER`, `search_path = ''`): `22023` si `p_to <= p_from` o el periodo pasa de 32 días (RF-18). Personas: las de `person_preferences` del llamante con `show_busy`, `share_busy` y calendario compartido, como mucho 8 (D5). Eventos: los de los calendarios de los que la persona es propietaria (también los traídos de sus cuentas) y los que ella creó (`created_by`) en cualquier calendario del que siga siendo miembro (D13). Devuelve por fila **solo** `person_id`, `starts_at`, `ends_at`, `all_day`, `recurrence`, `recurrence_tz` y `exdates`. Las excepciones salen como filas sueltas y sus fechas originales se añaden a los `exdates` de la serie en SQL, así no hace falta ningún id para emparejarlas (D2). `distinct` porque un evento puede estar en un calendario que comparten varias personas marcadas: sale una fila por persona.

### Sincronización (migración `sync_fast`)

- `synced_calendars` gana `remote_version text` (última versión leída del proveedor), `full_read_at timestamptz` (última lectura completa) y `push_pending_at timestamptz` (aviso aún no atendido). Los miembros ya leen esta tabla: ninguna columna nueva es secreta.
- `sync_channels (calendar_id pk → synced_calendars on delete cascade, channel_id uuid unique, resource_id text, token_hash text, expires_at timestamptz)`. RLS sin políticas ni permisos para clientes: solo la tocan las funciones (P4, el token no sale al navegador).
- `sync_channel_stops (channel_id, resource_id, connection_id → calendar_connections on delete cascade, queued_at)`. La llena un trigger `after delete` de `sync_channels` (dejar de traer, desconectar, borrar el calendario o renovar el canal). RLS sin políticas.
- `sync_due_calendars()` pasa a: activos de conexiones activas, sin actualización en curso (10 min, como hoy) y con **aviso pendiente** cuyo último intento fue hace más de 1 minuto, **o** último intento hace más de 15 minutos.
- `sync_claim_due` devuelve además `remote_version`, `full_read_at`, `push_pending_at` y `channel_expires_at` (cambia el tipo de retorno: `drop` y `create`).
- `sync_push(p_secret, p_channel_id, p_token, p_state)`: si el canal existe y `digest(p_token) = token_hash` y el estado no es `sync`, pone `push_pending_at = now()`. Devuelve `void` siempre, sin distinguir.
- `sync_store_channel(p_secret, p_calendar_id, p_channel_id, p_resource_id, p_token, p_expires_at)`: guarda el hash (sustituye al anterior; el trigger encola su cancelación).
- `sync_mark_checked(p_secret, p_calendar_id, p_version, p_full, p_started_at)`: guarda la versión, `full_read_at` si fue completa, `last_synced_at = now()` y `consecutive_failures = 0` (RF-30), y borra `push_pending_at` solo si es anterior a `p_started_at` (un aviso llegado durante la lectura vuelve a lanzarla).
- `sync_claim_stops(p_secret, p_limit)` y `sync_done_stop(p_secret, p_channel_id)`.
- `connect_account`: al sustituir el token de una cuenta existente borra sus `sync_channels` (se vuelven a crear con el token nuevo en la siguiente pasada, RF-20).
- `sync_trigger()`: también llama si hay cancelaciones en cola. `cron.alter_job` de `sync-run-due` a `* * * * *`.

## Contratos e interfaces

### Server Actions

- `setShareBusy(on: boolean): Promise<{ ok: true } | { error: string }>` y `setShowBusy(personId: string, on: boolean)`: igual que `setShareAvailability`, con `revalidatePath("/dashboard", "layout")`.

### Funciones

- `busyBlocks(rows: ExpandedBusyRow[], visible: ViewEvent[], timeZone): { timed: BusyBlock[]; allDay: BusyDay[] }` con `BusyBlock = { personId, startsAt, endsAt }` y `BusyDay = { personId, startDate, endDate }`.
- `needsFullRead({ version, stored, pushPending, fullReadAt, now }): boolean`.
- `pushHeaders(headers: Headers): { channelId, token, state } | null`, `shouldRenew(expiresAt, now)`, `newChannel(): { id, token }`.
- `ProviderSession.calendarVersion(calendarId): Promise<string | null>`; `watchCalendar?(calendarId, channel, address): Promise<{ resourceId; expiresAt }>`; `stopChannel?(channelId, resourceId): Promise<void>`.

### Rutas

- `POST /api/sync/google-push`: pública (no está bajo `/dashboard`, así que `getRouteAccess` ya la deja pasar). Siempre `200` sin cuerpo. Dirección registrada: `${SYNC_PUSH_URL}` = URL de producción + `/api/sync/google-push`, de una variable nueva `SYNC_PUSH_URL` (solo servidor). Sin ella (dev, previews) no se crean canales y se queda en 15 minutos (D8).

## Flujo principal paso a paso

1. **Consentir.** Ana activa en Ajustes "Mostrar a los demás cuándo estoy ocupado…" (RF-1 a RF-3) → `setShareBusy(true)` → `profiles.share_busy`.
2. **Marcar.** Su madre, que comparte con ella "Familia", abre los filtros: `busy_people()` la lista en "Disponibilidad" desmarcada (RF-5, RF-6). La marca → `setShowBusy` → `person_preferences.show_busy` (RF-7).
3. **Ver.** En semana o día, la página llama a `getBusyBlocks` con el periodo de la vista (≤ 32 días, RF-18) → `grid_busy` → expansión → `busyBlocks` quita lo que coincide con eventos visibles (RF-13) y junta (RF-12) → las vistas pintan "Ocupado · Ana" con su tinte (RF-8, RF-9, RF-11). Mes y agenda no lo piden (RF-16).
4. **Retirar.** Ana lo desactiva → la siguiente lectura de su madre (sin caché) ya no la recibe, ni en los bloques ni en la sección (RF-4, RF-17).
5. **Cambio en Google.** El usuario crea un evento en Google Calendar → Google avisa a `/api/sync/google-push` → `sync_push` marca el calendario (RF-19, RF-21) → en el siguiente minuto `sync_trigger` llama a `/api/sync/run` → lectura completa y `sync_apply_events` → aparece en CaFam (y la 019 refresca las pantallas abiertas). Varios avisos en un minuto solo dejan la marca una vez (RF-24).
6. **Sin avisos.** Cada 15 minutos el calendario vuelve a tocar: si la versión no cambió, solo se guarda la comprobación (RF-23, RF-27); si cambió, se lee (RF-26, RF-28).
7. **Dejar de traer.** `detach_synced_calendars` borra `synced_calendars` → cascada a `sync_channels` → el trigger encola la cancelación → la siguiente pasada llama a `channels.stop` (RF-22).

## Decisiones técnicas

- **D1: Consentimiento nuevo (`share_busy`) en lugar de reutilizar `share_availability`.** Descartado reutilizarlo porque quien dio permiso al asistente no aceptó salir en la rejilla de otros. Cubre: RF-1, RF-2.
- **D2: `grid_busy` devuelve la regla de repetición y las fechas excluidas, no intervalos ya expandidos.** Descartado expandir en SQL porque Postgres no expande RRULE (plan 013) y meter `ical.js` en la base no es posible. Una regla y sus fechas son solo horarios: no dicen nada que los intervalos no digan. Se quitan los ids (las excepciones se resuelven en SQL añadiendo sus fechas originales a `exdates`), así la respuesta no tiene nada con que pedir un evento. Lo que llega al navegador ya son solo `{persona, inicio, fin}`. Cubre: RF-10, NFR privacidad.
- **D3: Quitar los intervalos que coinciden con un evento visible en TypeScript, antes de juntar.** Descartado excluir en SQL los calendarios que el usuario comparte, porque un calendario oculto en los filtros no se ve y su evento sí debe salir como "Ocupado". Cubre: RF-12, RF-13.
- **D4: Las personas marcadas van en `person_preferences.show_busy`.** Descartado una tabla nueva porque esa tabla ya es la preferencia privada "por persona" y su RLS sirve tal cual. Cubre: RF-7.
- **D5: Como mucho 8 personas a la vez.** La novena casilla se deshabilita con "Como mucho 8 personas a la vez" y `grid_busy` corta en 8. Descartado sin límite porque con más de 8 columnas los bloques no se leen a 390 px (caso límite de la spec). Cubre: RF-6, RF-8.
- **D6: Bloque "Ocupado" con borde izquierdo del tinte del avatar, fondo `paper` con trama diagonal (token nuevo `bg-busy-hatch`, degradado suave como `bg-agenda-band`) y texto `muted`.** Descartado el discontinuo, que ya significa "evento que estás creando" (spec 008). Cubre: RF-9.
- **D7: Un aviso de Google solo marca el calendario; la actualización la hace la pasada de cada minuto.** Descartado actualizar dentro de la ruta del aviso (con `after()`), porque juntar avisos (RF-24) y encadenar tras una actualización en curso se resuelven solos con la marca y el `sync_started_at` que ya existe, y la ruta pública no abre sesiones con el proveedor. Coste: hasta 1 minuto de cola más hasta 1 minuto de lectura, dentro de los 2 de RF-19. Cubre: RF-19, RF-24, RF-25.
- **D8: Los canales se crean en la propia pasada del motor, no al elegir calendarios ni al reconectar.** Un calendario nuevo no tiene `last_attempt_at`, así que toca en el siguiente minuto y crea su canal; al reconectar, `connect_account` borra los canales de la cuenta. Descartado llamarlo desde `saveSelection` y el OAuth porque son tres sitios más donde puede fallar y la pasada ya tiene sesión con Google. Sin `SYNC_PUSH_URL` no se crean canales. Cubre: RF-20.
- **D9: Versión barata antes de leer.** Google: `events.list?maxResults=1&fields=updated` (`updated` es "la última modificación del calendario"). iCloud: `getctag`. Descartado `syncToken` de Google y `sync-collection` de CalDAV, que obligarían a cambiar `sync_apply_events` a cambios parciales, un rediseño del motor que la spec no pide. Aun así se lee todo cada 6 h por si la versión no reflejara algún cambio (R3). Cubre: RF-23, RF-26, RF-27, RF-28.
- **D10: Token del canal guardado como SHA-256 (`pgcrypto`) y comparado en SQL.** Descartado guardarlo en claro porque la tabla, aunque cerrada, es un secreto por canal. La ruta responde igual a todo (NFR seguridad). Cubre: RF-21.
- **D11: Cancelar con una cola llenada por trigger.** Descartado llamar a `channels.stop` desde las acciones de desconectar y dejar de traer, porque el borrado ocurre en varios sitios (incluido borrar el calendario o la cuenta) y el trigger los cubre todos. Si la conexión ya no existe (token revocado), la fila cae en cascada y el canal caduca solo (R4). Cubre: RF-22.
- **D12: La comprobación sin cambios cuenta como actualización correcta.** Pone `last_synced_at` y reinicia los fallos, así "Mis calendarios" no dice "hace 6 h" de un calendario comprobado hace 10 minutos. Un fallo al pedir la versión va por `sync_fail` como cualquier otro. Cubre: RF-29, RF-30.

- **D13: "Los calendarios de esa persona" (RF-10) son los suyos propios más los eventos que ella creó en los compartidos.** Descartado el criterio del asistente (todos los eventos de todos los calendarios de los que es miembro), porque lo que otro apunta en un calendario compartido no la ocupa a ella. Lo eligió el usuario el 2026-11-08. `assistant_busy` no cambia. Cubre: RF-10, RF-11.

### Límites del plan gratuito (NFR coste), con 20 calendarios traídos

- **pg_cron** cada minuto: 1.440 ejecuciones de `sync_trigger()` al día, una consulta `exists` cada una; solo llama a Vercel si hay trabajo.
- **Vercel**: como mucho una llamada por minuto (1.440 al día, ~43.000 al mes) de las 1.000.000 de invocaciones del plan Hobby; en la práctica, ~96 por las comprobaciones de 15 minutos más una por minuto con avisos. Una comprobación sin cambios son 20 peticiones cortas a los proveedores: CPU activa de unos cientos de milisegundos, unos 10 minutos al mes de las 4 h del plan.
- **Avisos**: ~10 llamadas al día por renovaciones de canales y una por aviso. Ruta del aviso: una consulta, sin proveedor.
- **Google**: 20 × 96 = 1.920 comprobaciones al día más las lecturas completas; la cuota gratuita es de 1.000.000 de peticiones al día por proyecto.
- **iCloud**: hasta 10 calendarios × 96 = 960 `PROPFIND` de profundidad 0 al día; sin límite publicado y del mismo orden que lo que hace un iPhone.

## Trazabilidad RF → módulo

| RF | Módulo |
|----|--------|
| RF-1 | `busy_grid` (`share_busy`), `setShareBusy`, `BusySetting` |
| RF-2 | D1, `BusySetting` |
| RF-3 | `BusySetting` |
| RF-4 | `grid_busy` sin caché, `setShareBusy` |
| RF-5 | `busy_people()`, `getBusyPeople`, filtros |
| RF-6 | filtros, `setShowBusy`, D5 |
| RF-7 | `person_preferences.show_busy` (D4), `setShowBusy` |
| RF-8 | `getBusyBlocks`, `time-grid.tsx`, vistas semana y día |
| RF-9 | `BusyBlock`, D6 |
| RF-10 | `grid_busy` (D2, D13), `busy.ts`, `expandRows` |
| RF-11 | `busy.ts` (`allDay`), `BusyBlock` en la franja de día completo |
| RF-12 | `busy.ts` |
| RF-13 | `busy.ts` (D3) |
| RF-14 | `BusyBlock` (globo) |
| RF-15 | `BusyBlock` fuera de `DraggableEvent`, sin `data-event-id` |
| RF-16 | vistas mes y agenda sin `busy` |
| RF-17 | `busy_people()` y `grid_busy` (filtran consentimiento y calendario compartido) |
| RF-18 | `grid_busy` (`22023`), `getBusyBlocks` |
| RF-19 | `google-push`, `sync_push`, cron cada minuto (D7) |
| RF-20 | `watchCalendar`, `run-sync.ts`, `channel.ts` (D8) |
| RF-21 | `sync_push` (D10), `channel.ts` |
| RF-22 | `sync_channel_stops`, `stopChannel` (D11) |
| RF-23 | `sync_due_calendars` (15 min), `calendarVersion` (D9) |
| RF-24 | `push_pending_at` + `sync_due_calendars` (1 min), D7 |
| RF-25 | `sync_claim_connection` sin cambios; la pasada no la usa |
| RF-26 | `sync_due_calendars` (15 min), `calendarVersion` de iCloud |
| RF-27 | `needsFullRead`, `sync_mark_checked` |
| RF-28 | `run-sync.ts` |
| RF-29 | `sync_fail` en todos los caminos (D12) |
| RF-30 | `sync_mark_checked` (D12) |

## Riesgos y mitigaciones

- **R1: Google exige verificar el dominio de los avisos.** La primera tarea de la parte de Google crea un canal real contra producción. Si Google lo rechaza por el dominio, se intenta verificar `calendario-familia-five.vercel.app` gratis con la etiqueta `meta` de Search Console; si tampoco se puede, se deja `SYNC_PUSH_URL` vacía y se queda en 15 minutos, como se acordó al aprobar la spec.
- **R2: Los avisos no se pueden probar en dev** (Google no llega a `localhost`). Los tests de la ruta simulan las cabeceras; la prueba real es la del criterio de finalización en producción.
- **R3: `updated` de Google o `getctag` de iCloud no cambian con algún tipo de cambio.** Lectura completa cada 6 h como red de seguridad (D9) y un test de integración del motor con una versión que no cambia y un evento que sí.
- **R4: Un canal cuyo token se revocó** sigue enviando avisos hasta caducar (como mucho 7 días). `sync_push` no lo encuentra y no hace nada (RF-21).
- **R5: Los bloques "Ocupado" no se refrescan solos** cuando la otra persona cambia un evento de un calendario que no comparte con el usuario: el aviso en vivo de la 019 solo llega a los miembros de ese calendario. Se ven al cambiar de periodo, volver a la pestaña tras 60 s o recargar. La spec no pide más (fuera de alcance, último punto).
- **R6: Cron cada minuto con una pasada que dura casi 60 s.** `sync_started_at` ya impide reclamar dos veces un calendario; dos pasadas a la vez se reparten lo pendiente.
- **R7: `grid_busy` lenta con muchas series.** Mismo filtro e índices que `assistant_busy`, ya medido en la 015; el periodo de una semana es mucho menor que los 31 días de allí.

## Dudas abiertas

- Ninguna. La de RF-10 se resolvió el 2026-11-08 (D13).
