# Spec 040 — Recordatorios y notificaciones push

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

CaFam no avisa de nada: ni antes de un evento ni cuando alguien comparte un calendario o comenta. La hoja de ruta prevé recordatorios con Web Push, gratis, y en iOS solo con la app instalada (iOS 16.4+). Ya hay `pg_cron` + `pg_net` llamando a rutas de la app con `CRON_SECRET` (specs 007, 012, 020) y un service worker propio.

## Objetivo

Recordatorios antes de los eventos y avisos sociales, por Web Push con VAPID firmado en el servidor con `node:crypto`, sin servicios ni dependencias de pago, configurables por el usuario y sin duplicados.

## Requisitos funcionales

### Suscripción

- RF-1: En Ajustes, sección "Notificaciones": "Activar en este dispositivo" pide permiso al navegador (solo tras pulsar, nunca al abrir) y guarda la suscripción del dispositivo (`endpoint`, claves `p256dh` y `auth`, nombre del dispositivo deducido del navegador).
- RF-2: La lista "Dispositivos con avisos" muestra cada suscripción del usuario con "Quitar". Una suscripción que el servicio de push da por caducada (404/410) se borra sola.
- RF-3: En iOS fuera de la app instalada, en lugar del botón se explica "En el iPhone los avisos solo funcionan con CaFam añadida a la pantalla de inicio" con el enlace a la ayuda de instalación. Si el permiso está denegado, se explica cómo reactivarlo en el navegador.
- RF-4: "Enviar un aviso de prueba" manda una notificación al dispositivo actual.

### Recordatorios

- RF-5: Cada evento puede tener hasta 3 recordatorios **personales** del usuario: "Al empezar", 5, 10, 15 y 30 min, 1 h, 2 h, 1 día, 2 días y 1 semana antes (en días completos: "El mismo día a las 9:00", "El día anterior a las 9:00", "Una semana antes a las 9:00").
- RF-6: En Ajustes, "Aviso por defecto" para eventos con hora (por defecto "10 min antes") y para días completos (por defecto "El día anterior a las 9:00"), o "Ninguno". Se aplica a los eventos que el usuario crea; en el alta aparece ya puesto y se puede cambiar.
- RF-7: Los recordatorios son de cada persona: otro miembro no los ve ni los recibe. Cualquier miembro (Lectores incluidos) puede ponerse recordatorios en cualquier evento que vea, desde el detalle ("Avisarme").
- RF-8: En una serie, el recordatorio vale para cada repetición; en una excepción con otra hora, se calcula con su hora. Una repetición borrada no avisa.
- RF-9: Los recordatorios se calculan en UTC con la hora real del evento (con hora) o a las 9:00 en la zona del perfil (días completos).
- RF-10: Cada recordatorio se envía **una sola vez** por persona, evento, repetición y antelación, aunque el envío se repita o haya varias ejecuciones a la vez. Si se envía con más de 15 min de retraso (servidor caído), no se envía.
- RF-11: La notificación dice el título, la hora ("Hoy a las 18:30 · en Calle Mayor 3") y al pulsarla abre el detalle del evento (o enfoca la app abierta).
- RF-12: Si el evento cambia de hora antes del aviso, avisa con la hora nueva; si se borra, no avisa.

### Notificaciones sociales

- RF-13: Avisos cuando: alguien se une a un calendario tuyo; te han dado acceso o cambiado el rol; alguien comenta en un evento que creaste o en el que comentaste; alguien cambia, mueve o borra un evento que creaste. Nunca por tus propias acciones ni por la sincronización con Google o iCloud.
- RF-14: Cada tipo se activa o desactiva en Ajustes (todos activados por defecto, salvo "cambios en mis eventos", desactivado).
- RF-15: Varios cambios del mismo actor sobre el mismo evento en 2 minutos se juntan en un aviso.
- RF-16: Sin suscripciones, nada se encola para esa persona (no crece la cola).

### Privacidad

- RF-17: La notificación viaja cifrada de extremo a extremo (RFC 8291); el servicio de push del navegador no ve el contenido. `/privacy` gana la sección "Notificaciones".
- RF-18: Cerrar sesión borra la suscripción del dispositivo; borrar la cuenta borra todas.

## Requisitos no funcionales

- RNF-1: Sin dependencias nuevas: VAPID (JWT ES256) y cifrado `aes128gcm` con `node:crypto`.
- RNF-2: Coste cero: `pg_cron` cada minuto llama a la ruta solo si hay algo que enviar (como `sync_trigger`).
- RNF-3: La clave privada VAPID solo en el servidor (P4); la pública con `NEXT_PUBLIC_`.
- RNF-4: Identidad Nexo y accesibilidad en Ajustes y en el detalle.

## Fuera de alcance

- Avisos por correo, sonidos propios, acciones en la notificación ("Posponer").
- Recordatorios compartidos que reciben todos los miembros.
- Avisos de notas.

## Riesgos

- iOS solo entrega avisos a la app instalada y puede retrasarlos; se documenta.
- Retraso de hasta 1 minuto por el cron: aceptable.
- Un fallo de cifrado haría que los avisos lleguen vacíos o no lleguen: tests con vectores del RFC 8291.

## Criterios de finalización

- Tests del cifrado con el vector de prueba del RFC 8291 y de la firma VAPID verificada con `crypto.verify`.
- Tests de cálculo de recordatorios (series, cambio de hora, días completos) y de integración (RLS, no duplicados, cola social).
- Prueba real en Chrome de escritorio con la app en `next start`; la de iPhone y Android queda para el usuario.
- P8 en verde con `test:db`; AGENTS.md, README, constitución y `/privacy` actualizados.

## Dudas abiertas

Ninguna.
