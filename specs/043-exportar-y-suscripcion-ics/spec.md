# Spec 043 — Exportar a `.ics` y suscripción de solo lectura

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

CaFam importa `.ics` (004) y sincroniza con Google e iCloud (007, 009, 018), pero no deja sacar los datos: ni descargar un calendario ni verlo desde otra app sin conectar una cuenta. Está en la hoja de ruta y en "Fuera de alcance".

## Objetivo

Descargar un calendario (o todos los visibles) como `.ics` y publicar un enlace secreto y revocable de suscripción `.ics` de solo lectura para verlo en Google Calendar, Apple Calendar u Outlook.

## Requisitos funcionales

### Exportar

- RF-1: En "Mis calendarios", en las opciones de cada calendario (tras "⋯", spec 032), "Exportar (.ics)" descarga `<nombre>.ics` con todos sus eventos. Cualquier miembro puede exportar lo que ve (Lectores incluidos).
- RF-2: En el panel de filtros, "Exportar los visibles" descarga un único `cafam.ics` con los eventos de los calendarios visibles, cada uno con `X-WR-CALNAME` "CaFam" y en cada evento la categoría `CATEGORIES:<nombre del calendario>`.
- RF-3: Cada evento lleva `UID` estable (`<id>@cafam`), `DTSTAMP`, `DTSTART`/`DTEND` (UTC con `Z` los de hora; `VALUE=DATE` los de día completo con fin exclusivo), `SUMMARY`, `DESCRIPTION`, `LOCATION`, `LAST-MODIFIED` y `CREATED`.
- RF-4: Una serie se exporta como un `VEVENT` con `RRULE` (la guardada), `DTSTART` con `TZID` de `recurrence_tz` y su `VTIMEZONE`, `EXDATE` por cada repetición borrada y un `VEVENT` con `RECURRENCE-ID` por cada excepción.
- RF-5: No se exportan imágenes, comentarios, colores, categorías propias ni autores (solo el nombre del calendario en RF-2).
- RF-6: El archivo es válido: lo lee de vuelta `parse-ics.ts` (004) y produce los mismos eventos (prueba de ida y vuelta).

### Suscripción

- RF-7: En la página "Compartir" de un calendario (solo el propietario, spec 003), sección "Suscripción (.ics)": "Crear enlace" genera una dirección secreta `https://…/api/ics/<token>.ics` (token de 43 caracteres), que se muestra con "Copiar", "Abrir en Google Calendar" (enlace `https://calendar.google.com/calendar/r?cid=webcal://…`) y `webcal://` para Apple.
- RF-8: El token solo se guarda como SHA-256 (como las invitaciones, 003) y no se puede volver a ver: "Crear uno nuevo" invalida el anterior. "Desactivar" lo revoca. Un calendario tiene como mucho un enlace activo.
- RF-9: La dirección devuelve el calendario con los eventos desde 6 meses atrás sin límite hacia adelante (las series con su regla), con `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=900` y `X-Robots-Tag: noindex`. Un token inválido o revocado → 404 sin cuerpo.
- RF-10: Sin sesión: el token es la única credencial. La lectura la hace una función `SECURITY DEFINER` que solo devuelve los eventos del calendario de ese token.
- RF-11: Si el calendario se borra, se junta o queda sin propietario (006), el enlace deja de funcionar.
- RF-12: La página de compartir avisa: "Cualquiera con este enlace verá todos los eventos del calendario. No se puede limitar a una persona."
- RF-13: `/privacy` explica la exportación y la suscripción.

## Requisitos no funcionales

- RNF-1: Sin dependencias nuevas: se escribe el `.ics` a mano (texto con plegado de líneas a 75 octetos y escapes de RFC 5545) o con `ical.js` en el servidor.
- RNF-2: 2.000 eventos en menos de 1 s.
- RNF-3: Límite de 60 peticiones por hora y enlace (los clientes de calendario piden cada 1–24 h); por encima, 429.

## Fuera de alcance

- Suscripción de todos los calendarios a la vez, enlaces por persona, exportar imágenes (lo hará la 049).

## Riesgos

- Un enlace filtrado expone el calendario: se puede regenerar y se avisa (RF-12).

## Criterios de finalización

- Tests de escritura `.ics` (escapes, plegado, día completo, series, excepciones, ida y vuelta) y de integración (token, revocación, RLS de la gestión, límite).
- P8 en verde con `test:db`; AGENTS.md, README, constitución y `/privacy` actualizados.

## Dudas abiertas

Ninguna.
