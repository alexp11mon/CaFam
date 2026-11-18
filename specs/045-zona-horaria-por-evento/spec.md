# Spec 045 — Zona horaria por evento

> Estado: aprobada de antemano por el usuario en el prompt de arranque (2026-11-18). Pendiente de implementar.

## Contexto

Los eventos con hora son instantes UTC que se escriben y muestran en la zona del **perfil** (spec 002, D6). Para un vuelo Madrid → Nueva York, o una videollamada con alguien de Canarias, hay que convertir a mano. Las series usan `recurrence_tz`, la zona de quien las creó (013). Está en "Fuera de alcance" de AGENTS.md y en el README.

## Objetivo

Que un evento con hora pueda tener su propia zona horaria (opcional; por defecto la del perfil), que se escriba en esa zona, que cada lector lo vea convertido a la suya y que el detalle muestre la hora original.

## Requisitos funcionales

- RF-1: En el formulario completo (alta y edición) de un evento con hora, "Zona horaria" aparece plegada como "En tu zona (Europe/Madrid)" con "Cambiar"; al abrirla, un selector con búsqueda de las zonas IANA (`Intl.supportedValuesOf("timeZone")`), con el desfase ("Nueva York (GMT−5)") y las 8 más usadas por el usuario arriba.
- RF-2: Opción "Inicio y fin en zonas distintas" para vuelos: zona de inicio y zona de fin por separado.
- RF-3: Las horas del formulario se interpretan en la zona elegida; al cambiar de zona, se conservan las horas escritas (se reinterpretan), no el instante.
- RF-4: Todas las vistas muestran el evento en la zona del perfil de quien mira (como hoy). El bloque no cambia.
- RF-5: El detalle (ventana, hoja y tarjeta) de un evento con zona propia distinta de la del lector muestra, bajo las horas, "18:00–20:00 en Nueva York (America/New_York)"; si son iguales, nada.
- RF-6: Un evento sin zona propia (todos los actuales) sigue igual: se muestra en la zona del lector y se edita en la del perfil de quien edita.
- RF-7: Días completos: no tienen zona (siguen por fecha UTC, 002 D6); el campo no aparece.
- RF-8: Series: la zona propia de un evento repetido es su `recurrence_tz`; elegirla en el formulario cambia la zona de la serie (las repeticiones siguen la hora de reloj de esa zona, también en el cambio de hora).
- RF-9: Calendarios traídos: al escribir en Google se envía `start.timeZone`/`end.timeZone`; en iCloud, `DTSTART;TZID=` con su `VTIMEZONE`. Al leer de Google o iCloud se guarda la zona del evento si la traen.
- RF-10: La importación `.ics` (004, 044) guarda el `TZID` reconocido como zona del evento; la exportación (043) la escribe.
- RF-11: Arrastrar, redimensionar, duplicar, pegar y Venito conservan la zona del evento.
- RF-12: Sin conexión, la zona se guarda en la copia y en la cola como un campo más.

## Requisitos no funcionales

- RNF-1: Sin dependencias: `Intl` y las funciones de `time-zone.ts`.
- RNF-2: La zona se valida en la base de datos como `profiles.time_zone` (`validate_time_zone`, sin `pg_timezone_names` por lentitud: trampa de la 013).

## Fuera de alcance

- Cambiar la zona de visualización de toda la app temporalmente ("ver como en Nueva York").
- Zonas en días completos.

## Riesgos

- Mezclar instante y hora de reloj: los instantes siguen guardándose en UTC; la zona solo sirve para editar y mostrar el original.

## Criterios de finalización

- Tests de conversión (incluidos cambios de hora y zonas con media hora, como Asia/Kolkata), de formulario, de detalle y de escritura a Google/iCloud con proveedores simulados; integración de la columna y su validación.
- P8 en verde con `test:db`; AGENTS.md (convención de fechas), README y constitución actualizados.

## Dudas abiertas

Ninguna.
