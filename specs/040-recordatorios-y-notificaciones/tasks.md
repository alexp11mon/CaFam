# Tasks 040 — Recordatorios y notificaciones push

Spec: `specs/040-recordatorios-y-notificaciones/spec.md`. Plan: `specs/040-recordatorios-y-notificaciones/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: cerrada (2026-11-18), T1–T8. Pendientes del usuario: `db push` a prod de la migración `push`, las claves VAPID en Vercel y las pruebas en el iPhone y Android.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T3 y T4.

## Tareas

- [x] T1 Cifrado y firma VAPID
  Hecho cuando: `npm test -- push-encrypt push-vapid` en verde.
  - `encryptPayload` reproduce byte a byte el ejemplo del RFC 8291 (sección 5) con sus claves y su sal.
  - `vapidJwt` produce un JWT cuya firma verifica `crypto.verify` con la clave pública; `aud` es el origen del endpoint y `exp` ≤ 24 h.
  - `scripts/make-vapid-keys.mjs`.

  Cubre: RF-17, RNF-1 | Evidencia: `npm test -- push-encrypt push-vapid` 4/4: `encryptPayload` reproduce byte a byte el cuerpo del ejemplo del RFC 8291 §5 y otro aleatorio se descifra; `vapidJwt` verificado con `crypto.verify`, `aud` el origen y `exp` 12 h; `scripts/make-vapid-keys.mjs`; P8 en verde (3.237 tests).
- [x] T2 Cálculo de recordatorios y textos
  Hecho cuando: `npm test -- push-reminders push-payload push-device` en verde.
  - `dueReminders`: con hora, días completos a las 9:00 en la zona, serie semanal, excepción movida, repetición borrada, cambio de hora en Europe/Madrid, retraso de más de 15 min descartado.
  - Textos ("Hoy a las…", "Mañana…", lugar opcional) y sociales; `pushSupport` para iOS sin instalar, denegado y listo.

  Cubre: RF-5, RF-8, RF-9, RF-10, RF-11, RF-12 | Evidencia: `npm test -- push-reminders push-payload push-device` 20/20: con hora, día completo a las 9:00 en la zona del perfil (los minutos de un día completo cuentan desde las 9:00 de su día: el valor por defecto es 1440, "El día anterior a las 9:00", en lugar del 900 del plan), serie semanal con cambio de hora, repetición borrada, excepción movida, retraso de más de 15 min descartado; textos de recordatorio y sociales; `deviceName` y `pushSupport`; P8 en verde (3.257 tests).
- [x] T3 Esquema, RLS y funciones
  Hecho cuando: `npm run test:db -- push` en verde.
  - Migración, `db:push`, `db:types`.
  - RLS: suscripciones y recordatorios solo propios; un no miembro no puede poner recordatorios; al salir del calendario se borran.
  - `push_mark_sent` no duplica con dos llamadas a la vez; funciones con secreto erróneo → `42501`.
  - Triggers sociales: comentario ajeno encola, el propio no; sin suscripción no encola; tipo desactivado no encola; cambio por sincronización no encola.

  Cubre: RF-2, RF-7, RF-10, RF-13 a RF-16, RF-18 | Evidencia: migración `20261121100000_push.sql` aplicada en dev (`db:push`, `db:types`); `npm run test:db -- push.test` 8/8: suscripciones solo propias y por `save_push_subscription` (un endpoint pasa a la última cuenta), recordatorios personales con pertenencia, máximo 3 y borrados al salir del calendario, aviso por defecto materializado por el trigger `event_reminders_default` (también cubre las altas de T4), `push_mark_sent` sin duplicar con dos llamadas a la vez, secreto erróneo → 42501, comentario ajeno encola y el propio no, sin dispositivo no encola, tipo desactivado no encola, cambios juntados en 2 min, sincronización (sin sesión) no encola, unirse y cambio de rol. `test:db` completo: 630/631 (`live-changes` dio timeout una vez y pasa al repetirlo, trampa conocida); P8 en verde (3.257 tests).
- [x] T4 Ruta de envío y aviso por defecto al crear
  Hecho cuando: `npm test -- push-run-route` (fetch simulado) y `npm run test:db -- push` en verde.
  - `/api/push/run`: 401 sin secreto; envía recordatorios y cola; 410 borra la suscripción; un fallo de una no para las demás.
  - `createEvent`, `createSingle` y las altas del asistente materializan el aviso por defecto del creador.

  Cubre: RF-6, RF-10, RF-11, RF-16, RNF-2 | Evidencia: `npm test -- push-run-route` 5/5 con `fetch` simulado: 401 sin secreto, recordatorio cifrado (`aes128gcm`, `TTL`, `vapid t=…, k=…`) enviado una vez, nada si otra ejecución ya lo marcó, 410 → `push_drop_subscription`, un fallo de red no para las demás, 500 sin claves VAPID. El aviso por defecto lo materializa el trigger `event_reminders_default` de T3 en toda alta con sesión (`createEvent`, `createSingle`, asistente, pegar), así que esas acciones no cambian; `no-secrets` vigila `VAPID_PRIVATE_KEY`. `npm run test:db -- push.test` 8/8; P8 en verde (3.262 tests).
- [x] T5 Service worker
  Hecho cuando: `npm test -- sw-push` (sw.js en `vm`, como `offline-sw-sync.test.ts`) en verde.
  - `push` muestra la notificación con `tag`; `notificationclick` enfoca una ventana abierta o abre la URL. `CACHE_NAME` `cafam-v8`.

  Cubre: RF-11 | Evidencia: `npm test -- sw-push` 5/5 (sw.js en `vm`): `push` muestra la notificación con `tag`, `renotify`, icono y la URL (aviso genérico si no hay datos legibles); `notificationclick` cierra, lleva una ventana abierta de la app a la URL y la enfoca, o abre una nueva, y nunca abre otro origen; `CACHE_NAME` `cafam-v8` (`brand-icons` y `offline-sw-sync` actualizados); P8 en verde.
- [x] T6 Ajustes y avisos en el evento
  Hecho cuando: `npm test -- notification-settings reminder-field event-form event-panel` en verde y capturas a 390, 768 y 1440 px en claro y oscuro en `capturas/`.
  - Activar, lista de dispositivos, prueba, iOS sin instalar, permiso denegado, avisos por defecto y tipos sociales.
  - `ReminderField` (hasta 3) en alta y edición, "Avisarme" en el detalle para Lectores.
  - Cerrar sesión borra la suscripción del dispositivo.

  Cubre: RF-1 a RF-7, RF-14, RF-18, RNF-4 | Evidencia: `npm test -- notification-settings reminder-field event-form event-panel push-options`: activar solo tras pulsar, lista de dispositivos con "Quitar", aviso de prueba a este dispositivo, iOS sin instalar, permiso bloqueado, aviso por defecto y tipos de aviso; `ReminderField` (hasta 3) en alta y edición y "Avisarme" en el detalle también para Lectores (se guarda al momento y se revierte si falla); cerrar sesión llama a `forgetPushSubscription` (`SignOutGuard`). Capturas en `capturas/` (`ajustes-notificaciones` y `detalle-avisarme`, 390, 768 y 1440 px, claro y oscuro, con `scripts/screenshots-040.mjs`). Sin conexión el detalle no ofrece avisos (necesitan red). P8 en verde (3.282 tests).
- [x] T7 Prueba real y privacidad
  Hecho cuando: con `next start -p 3100` y Edge/Chrome, activar avisos, crear un evento a 2 minutos y llamar a mano a `/api/push/run`: llega una notificación y al pulsarla abre el detalle (captura). `/privacy` con la sección "Notificaciones".

  Cubre: RF-11, RF-17 | Evidencia: `scripts/e2e-push.mjs` con `next start -p 3100` (claves VAPID de prueba solo en local) y Edge con ventana, 6/6: suscripción real al servicio de push de Windows (`wns2-…notify.windows.com`, "Edge en Windows"), aviso de prueba mostrado, alta desde el formulario con el aviso por defecto [10], `/api/push/run` llamado a mano dos veces (`sent` 1 y luego 0), el service worker muestra "Cena de prueba · Hoy a las 23:02" (descifrado por el navegador) con la URL del detalle, y esa URL abre el detalle (captura `capturas/prueba-real-detalle-1440.png`). Pulsar la notificación del sistema no se puede automatizar: lo cubre `sw-push` (`notificationclick`). `/privacy` gana la sección "Notificaciones" (`privacy-page` 11/11). Pendiente del usuario: iPhone y Android. P8 en verde (3.283 tests).
- [x] T8 Cierre
  Hecho cuando: AGENTS.md (spec, base de datos, rutas, variables, trampas de VAPID e iOS), README, constitución (hoja de ruta y P2 con Web Push) y `.env.example` actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: AGENTS.md (tabla de specs, sección de la 040, base de datos, ruta `/api/push/run`, variables VAPID, `sw.js` `cafam-v8`, estructura y trampas de VAPID, dev e iOS), README (estado, "Recordatorios y notificaciones", ruta, variables, PWA y hoja de ruta), constitución (hoja de ruta con la 040 y P2 con los servicios de Web Push) y `.env.example` con las tres variables VAPID; `python -m graphify update .`; P8 en verde (3.283 tests).

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-4 | T6 |
| RF-5, RF-8, RF-9, RF-12 | T2 |
| RF-6 | T4, T6 |
| RF-7 | T3, T6 |
| RF-10, RF-11 | T2, T3, T4, T5 |
| RF-13 a RF-16 | T3 |
| RF-17 | T1, T7 |
| RF-18 | T3, T6 |
