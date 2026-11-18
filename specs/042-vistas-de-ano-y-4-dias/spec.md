# Spec 042 — Vistas de año y de 4 días

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

El calendario tiene agenda, mes, semana y día (`CalendarView` en `lib/calendar/ranges.ts`). Faltan, como en Google Calendar, la vista de **año** (para planificar vacaciones y ver qué días tienen algo) y la de **4 días** (cómoda en el móvil apaisado y en tabletas). Están en la hoja de ruta.

## Objetivo

Dos vistas nuevas integradas como las demás: en `CalendarClient` sin red al cambiar de periodo, en `useEventWindow`, con deslizar, atajos, la vista recordada y la copia sin conexión.

## Requisitos funcionales

### Año

- RF-1: Vista "Año" (`view=year`): los 12 meses del año de la fecha, en rejilla (1 columna a 390 px, 2 a 768, 3 a 1024 y 4 desde 1280 px), cada uno como un mini mes (iniciales L M X J V S D, lunes primero).
- RF-2: Cada día con eventos de los calendarios visibles lleva una marca: hasta 3 puntos con el color de sus calendarios (como `month-marks` del mini calendario); hoy en círculo de acento; fines de semana ocultos no cambian el año (como el mini calendario, spec 019).
- RF-3: Pulsar un día abre la vista día de esa fecha; pulsar el nombre de un mes abre la vista mes.
- RF-4: Anterior/siguiente y deslizar cambian de año; "Hoy" vuelve al año actual. El título es el año.
- RF-5: Para que sea rápido, el año pide solo **qué días tienen eventos y de qué calendarios** (no los eventos completos) con una lectura agregada.

### 4 días

- RF-6: Vista "4 días" (`view=4days`): rejilla de horas como la semana, con 4 columnas empezando en la fecha; anterior/siguiente avanzan 4 días.
- RF-7: Todo lo de la semana funciona igual: crear arrastrando o pulsando, mover y redimensionar (017), tarjeta de detalle (019), "Ocupado" (020), franja de día completo, pellizcar, línea de ahora.
- RF-8: "Ocultar fines de semana" no afecta a 4 días (son días seguidos), igual que la vista día.

### Comunes

- RF-9: Atajos **Y** (año) y **X** (4 días), en `SHORTCUTS` y en la ayuda (?), y en los botones del selector de vista.
- RF-10: El selector de vista del escritorio y del móvil (`CalendarHeading`) muestra las 6 vistas; en el móvil, año y 4 días van en un menú "Más vistas" para no apretar las pestañas.
- RF-11: La vista elegida se recuerda (`profiles.last_view`) como las demás.
- RF-12: Cambiar de periodo no pide la página al servidor (spec 024): `CalendarClient` y `useEventWindow` conocen los rangos nuevos.
- RF-13: Sin conexión, las dos vistas funcionan con la copia; las fechas fuera del rango guardado muestran "Estas fechas no están disponibles sin conexión" (en el año, los meses fuera del rango quedan atenuados con esa nota).

## Requisitos no funcionales

- RNF-1: Cambiar de año en menos de 150 ms con la CPU 4× ralentizada tras la primera carga.
- RNF-2: Identidad Nexo; capturas a 390, 768 y 1440 px en claro y oscuro.

## Fuera de alcance

- Número de días configurable (solo 4), vista de año con títulos de eventos.

## Riesgos

- El año con 3.000 eventos: por eso la lectura agregada (RF-5).

## Criterios de finalización

- Tests de rangos, navegación, atajos y vistas; prueba en el navegador; P8 en verde con `test:db`; AGENTS.md, README y constitución actualizados.

## Dudas abiertas

Ninguna.
