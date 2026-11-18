# Plan 040 — Recordatorios y notificaciones push

Spec: `specs/040-recordatorios-y-notificaciones/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

```
Navegador ── pushManager.subscribe(VAPID público) ──▶ savePushSubscription (Server Action) ──▶ push_subscriptions
pg_cron (cada minuto) ── push_trigger() ── net.http_post ──▶ POST /api/push/run (hasCronSecret)
   /api/push/run:
     1. push_claim_reminders(p_secret, ventana)  → recordatorios con evento (series incluidas)
     2. expande series en TS (expandRows), calcula el instante de cada aviso
     3. push_mark_sent(p_secret, claves)          → inserta en push_deliveries; solo las nuevas
     4. push_claim_notifications(p_secret)        → avisos sociales encolados por triggers
     5. por cada suscripción: payload cifrado (aes128gcm) + JWT VAPID → fetch(endpoint)
     6. 404/410 → push_drop_subscription
sw.js: evento push → showNotification; notificationclick → abrir/enfocar la URL
```

Sin `service_role`: como en la 007, las funciones del trabajo en segundo plano son `SECURITY DEFINER` y piden `p_secret` (comparado con `cron_secret` de Vault).

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `supabase/migrations/20261121100000_push.sql` | Tablas, RLS, triggers sociales y funciones (ver Modelo de datos) |
| `src/lib/push/vapid.ts` | `vapidJwt(audience, subject, privateJwk, now)`: ES256 con `crypto.sign(..., { dsaEncoding: "ieee-p1363" })` |
| `src/lib/push/encrypt.ts` | `encryptPayload(payload, p256dh, auth, salt?, serverKeys?)`: ECDH P-256, HKDF y AES-128-GCM según RFC 8291/8188 |
| `src/lib/push/send.ts` | `sendPush(subscription, payload)`: `fetch` con `TTL`, `Content-Encoding: aes128gcm`, `Authorization: vapid t=…, k=…`; devuelve `ok | gone | retry` |
| `src/lib/push/reminders.ts` (puro) | `REMINDER_OPTIONS`, `dueReminders(rows, now, window)`: instante de cada aviso, series, días completos a las 9:00 en la zona, descarte de más de 15 min de retraso |
| `src/lib/push/payload.ts` (puro) | Texto y URL de cada aviso ("Hoy a las 18:30 · en …"; sociales) |
| `src/lib/push/device.ts` (puro) | Nombre del dispositivo desde el user agent; `pushSupport()` (no soportado, iOS sin instalar, denegado, listo) |
| `src/app/api/push/run/route.ts` | Trabajo de envío (`maxDuration` 60) |
| `src/app/dashboard/settings/push-actions.ts` | `savePushSubscription`, `removePushSubscription`, `sendTestPush`, `setNotificationPrefs`, `setDefaultReminders` |
| `src/app/dashboard/events/reminder-actions.ts` | `setEventReminders(eventId, minutes[])` (id de repetición → serie) |
| `src/components/settings/notification-settings.tsx` | Sección de Ajustes (RF-1 a RF-4, RF-6, RF-14) |
| `src/components/calendar/reminder-field.tsx` | Selector de hasta 3 avisos en el alta, la edición y el detalle ("Avisarme") |
| `public/sw.js` | `push` y `notificationclick`; `CACHE_NAME` `cafam-v8` |
| `src/app/privacy/page.tsx` | Sección "Notificaciones" |
| `.env.example` | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `scripts/make-vapid-keys.mjs` | Genera el par con `crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" })` |

## Modelo de datos

- `push_subscriptions (id, user_id → profiles cascade default auth.uid(), endpoint text unique, p256dh text, auth text, device text, created_at, last_used_at)`. RLS: el usuario lee, inserta y borra las suyas; nadie actualiza (lo hace la función de envío).
- `profiles` gana `reminder_minutes int` (null = ninguno, por defecto 10), `reminder_all_day_minutes int` (minutos antes de las 9:00 del día; por defecto 900 = el día anterior a las 9:00) y `notify jsonb` (`{"joined":true,"access":true,"comments":true,"changes":false}`).
- `event_reminders (user_id, event_id → events cascade, minutes int[] check cardinality ≤ 3, created_at, updated_at)`, PK `(user_id, event_id)`. RLS: el usuario lee y escribe las suyas solo si `is_calendar_member` del calendario del evento. Al salir del calendario, un trigger borra las suyas. Las de una serie van en la fila de la serie.
- `push_deliveries (user_id, event_id, occurrence_start timestamptz, minutes int, sent_at)`, PK de las cuatro primeras: garantiza RF-10 con `insert … on conflict do nothing returning`. Sin permisos de cliente; `pg_cron` borra las de más de 8 días.
- `push_outbox (id, user_id, kind, payload jsonb, collapse_key text, created_at, claimed_at)`. La llenan triggers `SECURITY DEFINER` en `calendar_members` (alta y cambio de rol), `event_comments` (alta) y `events` (cambio y borrado con `auth.uid()` distinto de `created_by`), solo si el destinatario tiene alguna suscripción y el tipo activado (RF-14, RF-16). `collapse_key` = `actor:evento` junta en 2 minutos (RF-15).
- Funciones con `p_secret`: `push_due_reminders(p_secret, p_from, p_to)` (filas de evento con sus recordatorios y la zona del usuario, incluidas series cuyo `recurrence_until` alcanza la ventana, y el `reminder_*` por defecto ya resuelto al crear), `push_mark_sent`, `push_claim_notifications`, `push_subscriptions_for(p_secret, p_user_ids)`, `push_drop_subscription`, `push_touch_subscription` y `push_trigger()` (solo llama si hay recordatorios en los próximos 2 minutos o cola).
- `pg_cron` `push-run` cada minuto y `push-purge` diario.

## Decisiones

- D1: Sin librería `web-push`: el cifrado `aes128gcm` y el JWT ES256 caben en unas 120 líneas con `node:crypto`, y P6 pide no añadir dependencias si hay alternativa razonable. Se prueban con el vector del RFC 8291.
- D2: El aviso por defecto se **materializa** al crear el evento (una fila en `event_reminders` del creador), no se calcula al enviar: así cambiar el valor por defecto no cambia los eventos ya creados (como Google) y el envío solo lee una tabla.
- D3: Recordatorios personales (RF-7): en un calendario familiar, avisar a todos de todo sería ruido. Quien quiera el aviso se lo pone.
- D4: La expansión de series se hace en TypeScript (SQL no expande reglas; spec 013). La función SQL devuelve la serie y TS calcula los instantes en la ventana `[now − 15 min, now + 1 min]`.
- D5: Payload pequeño (< 3 KB, límite de 4 KB de Web Push): título, cuerpo, URL y `tag` (`event:<id>` para que una actualización sustituya a la anterior).
- D6: Los triggers sociales ignoran `auth.uid() is null` (sincronización y servidor), así Google e iCloud nunca disparan avisos (RF-13).
- D7: `VAPID_SUBJECT` = `mailto:` del remitente de Brevo ya configurado; si falta, la URL de producción.

## Pasos de producción (los ejecuta el usuario)

1. Generar las claves en local: `node scripts/make-vapid-keys.mjs` (imprime las dos en base64url).
2. En Vercel (Production y Preview): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`. Redeploy.
3. Migración:
```
npx supabase link --project-ref yznbdoskvtxeasujtirk
npx supabase db push
npx supabase link --project-ref uthubyzhonrtrmbcqcjh
```
4. Comprobar que `sync_app_url` en Vault de prod apunta a la URL de producción (lo usa `push_trigger`).
5. En el iPhone: volver a abrir la app instalada (service worker `cafam-v8`) y activar los avisos en Ajustes.

## Riesgos

- Cambiar las claves VAPID invalida todas las suscripciones: se documenta en AGENTS.md.
- En dev, `pg_cron` no llega a `localhost` (trampa de la 020): se prueba llamando a mano a `POST /api/push/run`.
