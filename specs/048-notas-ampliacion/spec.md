# Spec 048 — Ampliación de Notas

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Las notas (028) tienen listas y textos, personales o compartidos por calendario, fecha límite por nota, fijar, archivar y búsqueda. AGENTS.md §11 deja fuera: fecha límite por elemento, reordenar arrastrando, vencimientos en el calendario, notas de un evento y notas desde el asistente.

## Objetivo

Completar las notas con esas cinco cosas, manteniendo la edición optimista, el tiempo real y el modo sin conexión.

## Requisitos funcionales

### Fecha límite por elemento

- RF-1: Cada elemento de una lista puede tener fecha límite (y hora opcional) desde su menú "⋯" o deslizando en el móvil: "Hoy", "Mañana", "Próxima semana" o una fecha.
- RF-2: El elemento muestra la fecha ("mañana", "vie 21", en `danger` si venció y no está hecho). La tarjeta de la nota muestra la más próxima pendiente.

### Reordenar

- RF-3: Los elementos de una lista se reordenan arrastrando con el ratón (asa a la izquierda) y con el dedo (mantener pulsado 300 ms el asa), con autodesplazamiento cerca del borde.
- RF-4: Con teclado: el asa enfocada con Alt+↑/↓ sube o baja el elemento, y se anuncia "Movido a la posición 3 de 8".
- RF-5: El orden se guarda con `position` (como hoy) y se ve al instante en otros dispositivos (tiempo real). Los elementos hechos siguen bajando al final si la lista lo tiene activado.

### Vencimientos en el calendario

- RF-6: En los filtros del calendario, "Tareas con fecha" (desactivado por defecto, recordado por usuario) muestra en la franja de día completo de semana y día, en el mes y en la agenda las notas y elementos con fecha límite pendientes como bloques discretos con casilla ("☐ Comprar regalo · Lista de la compra").
- RF-7: Marcar la casilla en el calendario completa el elemento (optimista, con "Deshacer"); pulsar el texto abre la nota.
- RF-8: Solo aparecen las notas que el usuario puede ver (personales propias y compartidas de sus calendarios visibles).

### Notas de un evento

- RF-9: En el detalle de un evento, sección "Notas": "Añadir nota" crea una nota (lista o texto) **vinculada** al evento, compartida en su calendario (o personal si el usuario lo elige y el evento es de un calendario donde no puede escribir notas).
- RF-10: El detalle lista las notas vinculadas que el usuario puede ver, con su progreso ("2/5"); la nota muestra "De: Cena con Ana · 20 nov" con enlace al evento.
- RF-11: Borrar el evento desvincula las notas (no las borra); en una serie, la nota se vincula a la serie o a la repetición elegida (como imágenes y comentarios, con `materialize_occurrence`).

### Notas desde Venito

- RF-12: Venito crea notas y añade elementos a una lista cuando se le pide ("apunta leche y pan en la lista de la compra", "crea una nota con…"), con el mismo patrón de la 036: crea al momento, como mucho 3 por mensaje, tarjeta con enlace y "Deshacer".
- RF-13: La lista se elige por nombre sin tildes ni mayúsculas (como `matchCalendar`); si no existe, Venito pregunta si crearla. Nunca borra notas.
- RF-14: Venito también responde preguntas de lectura sobre notas ("¿qué queda en la lista de la compra?") con una herramienta de solo lectura.

### Sin conexión

- RF-15: Todo lo anterior funciona sin red con la cola de la 034 (fechas, orden, completar desde el calendario, vincular), salvo Venito, que necesita red.

## Requisitos no funcionales

- RNF-1: Sin dependencias (arrastre con Pointer Events como `use-event-drag.ts`).
- RNF-2: Identidad Nexo, capturas y accesibilidad (RF-4).
- RNF-3: `eval:assistant` con 5 preguntas nuevas de notas; se lanza una vez por la cuota de Groq.

## Fuera de alcance

- Recordatorios push de las tareas (se podría añadir sobre la 040 en otra spec), subtareas, asignar elementos a personas.

## Riesgos

- Reordenar con varios editores a la vez: se reordena por `position` fraccionaria para no renumerar toda la lista.

## Criterios de finalización

- Tests unitarios y de integración por bloque; prueba en el navegador; P8 en verde con `test:db`; AGENTS.md (§11), README y constitución actualizados.

## Dudas abiertas

Ninguna.
