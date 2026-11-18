# Spec 044 — Importar a un calendario existente y actualizar lo importado

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

La importación `.ics` (004) es única y crea siempre un calendario nuevo: no se puede añadir un `.ics` a un calendario que ya existe ni mantener al día un calendario publicado por enlace (el del colegio, el de un equipo, los festivos). Las dos cosas están en la hoja de ruta y en "Fuera de alcance".

## Objetivo

1. Importar un `.ics` (enlace o archivo) a un calendario existente que el usuario puede escribir, sin duplicar lo ya importado.
2. Al importar desde un enlace, poder **mantenerlo actualizado**: CaFam guarda el enlace y vuelve a leerlo periódicamente y con "Actualizar ahora", reconciliando por `UID`.

## Requisitos funcionales

### Importar a un calendario existente

- RF-1: En `/dashboard/import`, "Destino": "Un calendario nuevo" (como hoy) o "Un calendario que ya tengo" con un selector de los calendarios normales donde el usuario es Propietario o Editor (no traídos de Google o iCloud, que tienen su propia sincronización).
- RF-2: Cada evento importado guarda su identidad del `.ics` (`UID` y, en una repetición, su `RECURRENCE-ID` o instante) como `external_id`. Un evento con la misma identidad ya presente en el calendario no se vuelve a crear ("3 ya estaban").
- RF-3: El resumen dice cuántos se añadieron, cuántos ya estaban y cuántos se omitieron (como la 004).
- RF-4: Los límites de la 004 se mantienen (2 MB, 2.000 eventos por importación) y el calendario destino no pasa de 10.000 eventos importados.

### Mantener actualizado

- RF-5: Al importar desde un enlace (nuevo o existente), la casilla "Mantener actualizado desde este enlace" (desactivada por defecto) guarda la suscripción. Solo una suscripción por calendario.
- RF-6: Un calendario con suscripción muestra en "Mis calendarios" "Actualizado desde un enlace · hace 2 h", con "Actualizar ahora" (cada 5 minutos como mucho) y "Dejar de actualizar" (conserva los eventos).
- RF-7: Se actualiza solo cada 6 horas. Una actualización: añade los eventos nuevos del enlace, cambia los que cambiaron (título, descripción, lugar, fechas, todo el día) y borra los que ya no están, **solo entre los eventos que vinieron del enlace** (`external_id` de esa suscripción) y dentro del periodo leído (de hoy −6 meses a +12 meses, con la regla de la 038).
- RF-8: Lo que el usuario cambió en CaFam después de la última lectura no se pisa (como la 009: gana el último cambio); el color, la categoría, las imágenes y los comentarios de un evento importado se conservan al actualizar.
- RF-9: Los eventos creados en CaFam (sin `external_id`) nunca se tocan.
- RF-10: Tres fallos seguidos (enlace caído, archivo inválido) avisan en "Mis calendarios" ("No se pudo actualizar «Colegio» desde su enlace") con el motivo; un enlace que da 404 o 410 tres veces deja la suscripción en pausa con "Reintentar".
- RF-11: El enlace guardado solo lo ven el propietario de la suscripción (quien la creó); los demás miembros ven que el calendario se actualiza desde un enlace, no la dirección.
- RF-12: La descarga usa la protección anti-SSRF de la 004 (`fetch-ics.ts` con `lookup` propio) y su límite de tamaño y plazo.
- RF-13: Borrar el calendario, juntarlo o dejarlo sin propietario borra la suscripción. Si quien la creó sale del calendario o pierde el rol de Editor, la suscripción se pausa.

## Requisitos no funcionales

- RNF-1: Coste cero: `pg_cron` llama a la app solo si hay suscripciones vencidas, en tandas de 4 durante 50 s como mucho (como la 007).
- RNF-2: Sin dependencias nuevas (ical.js y `fetch-ics.ts` existentes).

## Fuera de alcance

- Escribir en el origen (es de solo lectura por naturaleza), suscripciones a calendarios con autenticación (usuario y contraseña), CalDAV genérico.

## Riesgos

- Las series del `.ics` se expanden en repeticiones sueltas (como en la 004): una serie larga genera muchas filas; el tope de 10.000 lo acota.
- El enlace puede contener un secreto (los enlaces privados de Google o iCloud): se guarda en Vault (P4).

## Criterios de finalización

- Tests de reconciliación (añadir, cambiar, borrar, no pisar lo cambiado en CaFam, no tocar lo propio) y de RLS; prueba con un `.ics` servido en local.
- P8 en verde con `test:db`; AGENTS.md, README y constitución actualizados.

## Dudas abiertas

Ninguna.
