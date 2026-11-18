# Spec 039 — Búsqueda de eventos

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

No hay forma de encontrar un evento sin saber su fecha. El asistente (015) busca con `search_events`, pero gasta cuota de Groq y no sirve sin conexión. La búsqueda está en la hoja de ruta de la constitución y en el README.

## Objetivo

Una búsqueda rápida por título, lugar, descripción y comentarios en todos los calendarios que el usuario puede ver, con resultados agrupados por fecha, en el móvil y en el escritorio, también sin conexión con la copia del dispositivo.

## Requisitos funcionales

- RF-1: Botón "Buscar" (lupa) en la cabecera del calendario: en el móvil en `CalendarHeading`, desde 769 px en `TopNav`. La tecla `/` abre la búsqueda (añadida a `SHORTCUTS` y a la ayuda), nunca escribiendo ni con una ventana abierta.
- RF-2: La búsqueda se abre en una ruta propia `/dashboard/search?q=` (el enlace se puede compartir y recargar) con un campo de 16 px enfocado al abrir, "Cerrar" y Escape.
- RF-3: Busca en título, lugar y descripción de los eventos y en el texto de sus comentarios, sin distinguir mayúsculas ni tildes ("medico" encuentra "Médico"), por palabras completas o prefijos ("denti" encuentra "Dentista").
- RF-4: Solo devuelve eventos de calendarios de los que el usuario es miembro (RLS), con los filtros de visibilidad **ignorados**: busca también en calendarios ocultos, y lo indica con "Oculto en el calendario" en la fila.
- RF-5: Las series aparecen como una fila por **repetición** dentro del periodo buscado: por defecto desde 1 año atrás hasta 2 años adelante; "Buscar más atrás" amplía 2 años cada vez.
- RF-6: Resultados agrupados por día (cabecera "Jueves, 20 de noviembre de 2026"), con los próximos primero y "Pasados" después en orden inverso; cada fila es un `EventBlock` con hora, título, lugar y calendario, y abre el detalle (ventana o hoja como en el calendario).
- RF-7: Si coincide un comentario, la fila muestra un extracto con la palabra resaltada (`<mark>` con tokens).
- RF-8: Busca mientras se escribe (350 ms tras la última tecla, desde 2 caracteres); como mucho 100 resultados con "Hay más resultados: afina la búsqueda".
- RF-9: Estados: vacío inicial con las 5 últimas búsquedas del dispositivo (`localStorage`, borrables), "Buscando…", sin resultados con Venito confundido, y error con "Reintentar".
- RF-10: Sin conexión, busca en la copia del dispositivo (spec 034/035: eventos del rango, sus comentarios) con el mismo criterio de tildes, y avisa "Buscando solo en los datos de este dispositivo (de hoy −1 mes a +3 meses)".
- RF-11: Los eventos traídos de Google e iCloud se buscan igual (son filas de `events`).
- RF-12: Lector de pantalla: el número de resultados se anuncia en una región `aria-live`.

## Requisitos no funcionales

- RNF-1: Respuesta del servidor en menos de 300 ms con 20.000 eventos en dev (índice).
- RNF-2: Sin dependencias nuevas; extensiones de Postgres incluidas en Supabase Free (`pg_trgm`, `unaccent`).
- RNF-3: Identidad Nexo y capturas a 390, 768 y 1440 px en claro y oscuro.

## Fuera de alcance

- Filtros avanzados (por calendario, por persona, por fechas exactas) y operadores.
- Buscar en notas (sección propia, ya tiene su buscador).
- Buscar en imágenes.

## Riesgos

- Las series se expanden en el servidor con `ical.js`: una serie que coincide puede dar cientos de repeticiones; se recorta a las del periodo y al máximo de 100.
- RLS opaca al planificador (Diferido de la 023): la función de búsqueda filtra primero por calendarios del usuario.

## Criterios de finalización

- Tests unitarios de normalización, agrupado y estados; tests de integración de RLS (un ajeno no ve nada, un expulsado tampoco) y de tildes.
- Prueba en el navegador con y sin conexión.
- P8 en verde con `test:db`; AGENTS.md, README y constitución (hoja de ruta) actualizados.

## Dudas abiertas

Ninguna.
