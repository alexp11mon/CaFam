# Spec 038 — La sincronización no borra lo que queda fuera de la ventana

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

La sincronización con Google e iCloud (specs 007, 009, 018 y 020) lee los eventos de una **ventana** (6 meses atrás, 12 adelante; `syncWindow`) y `sync_apply_events` borra todo evento del calendario traído con `external_id` que no venga en la lectura. Así, un evento creado desde CaFam (o traído antes) que **sale de la ventana** se borra en la siguiente lectura, con sus imágenes y comentarios. La spec 023 lo dejó en "Diferido" como el pendiente más importante.

Hay un segundo caso con el mismo efecto: cuando el proveedor devuelve más de 2.000 eventos, `limitEvents` se queda con los más cercanos a hoy y los demás (`omitted`) tampoco llegan a `sync_apply_events`, que los borra aunque estén dentro de la ventana.

## Objetivo

Que la reconciliación solo borre lo que **debería haber leído y no estaba**: eventos que solapan la ventana leída y que no se omitieron por el límite. Lo antiguo se queda como copia que ya no se actualiza.

## Requisitos funcionales

- RF-1: `sync_apply_events` recibe el inicio y el fin de la ventana leída y solo borra eventos con `external_id` que **solapan** esa ventana (`starts_at < fin` y `ends_at > inicio`; un evento de día completo, igual).
- RF-2: Un evento con `external_id` totalmente fuera de la ventana no se borra ni se cambia, conserve o no imágenes y comentarios.
- RF-3: Los eventos omitidos por el límite de 2.000 (`omitted`) no se borran: el motor pasa sus `external_id` y la función los deja como están.
- RF-4: Sin ventana (llamadas antiguas o tests con los argumentos de siempre) la función se comporta como hasta ahora, para no romper llamadas en curso durante el despliegue.
- RF-5: Si un evento antiguo vuelve a entrar en la ventana (el usuario mira el pasado, o el proveedor lo mueve dentro), la siguiente lectura lo actualiza por `external_id` como cualquier otro: no se duplica.
- RF-6: Si un evento antiguo se borró en el proveedor mientras estaba fuera de la ventana, CaFam lo conserva. El detalle de un evento traído que empezó hace más de 6 meses dice "Copia antigua: ya no se actualiza desde Google" (o "iCloud").
- RF-7: Editar o borrar desde CaFam un evento antiguo de un calendario traído sigue escribiendo primero en el proveedor (spec 009). Si el proveedor responde que no existe, se aplica lo que ya hace hoy (`gone`).
- RF-8: El resumen de la actualización (`last_summary`) no cuenta como borrados los eventos fuera de la ventana ni los omitidos.
- RF-9: Desconectar una cuenta o dejar de traer un calendario sigue ofreciendo "conservar o borrar" con todos sus eventos, también los antiguos.

## Requisitos no funcionales

- RNF-1: La lectura no se alarga: la condición de solape usa el índice existente por calendario y fechas.
- RNF-2: Sin cambios visibles para quien no tenga eventos antiguos.

## Fuera de alcance

- Ampliar la ventana o leer el pasado bajo demanda.
- Borrar automáticamente las copias antiguas pasado un tiempo.
- Cambiar la ventana de la subida a Google (`upload-plan.ts`).

## Riesgos

- Un evento borrado en el proveedor fuera de la ventana queda para siempre en CaFam: es la decisión de producto (mejor conservar que perder imágenes y comentarios). Se anuncia en el detalle (RF-6).
- Desplegar la función nueva antes que la app: los argumentos nuevos tienen valor por defecto (RF-4).

## Criterios de finalización

- Tests de integración con eventos a los dos lados de la ventana, uno en el borde y omitidos por el límite.
- P8 en verde con `test:db`.
- AGENTS.md (spec, base de datos y trampa del pasado) y README actualizados.

## Dudas abiertas

Ninguna.
