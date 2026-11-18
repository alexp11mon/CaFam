# Plan 041 — Alta de eventos en lenguaje natural

Spec: `specs/041-alta-en-lenguaje-natural/spec.md`.

> Estado: aprobado de antemano por el usuario en el prompt de arranque (2026-11-18).

## Resumen de arquitectura

Todo en el navegador y puro:

```
texto ──▶ tokenize (minúsculas sin tildes, con posiciones en el original)
      ──▶ reconocedores en orden: calendario (@), rango de fechas, fecha, día, relativo,
          horas (rango, hora, franja), duración, todo el día, repetición, lugar
      ──▶ cada uno consume tramos [inicio, fin) y no se solapan
      ──▶ resto = título
      ──▶ ParsedEvent { title, date, endDate, start?, end?, allDay, location?, calendarHint?, repeat?, spans[], warnings[] }
```

`resolveParsed(parsed, { now, timeZone, defaultMinutes, calendars })` lo convierte en los valores del formulario (`NewEventQuery` de `new-event-query.ts`) con `matchCalendar` (036) y `zonedLocalToUtc`.

## Módulos y responsabilidades

| Módulo | Cambio |
|--------|--------|
| `src/lib/nl/tokenize.ts` | Normaliza y guarda posiciones |
| `src/lib/nl/dates.ts` | RF-1 a RF-3, RF-6 (fechas y rangos) |
| `src/lib/nl/times.ts` | RF-4, RF-5, RF-15 |
| `src/lib/nl/extras.ts` | Lugar, calendario, repetición (RF-7, RF-8, RF-10) |
| `src/lib/nl/parse.ts` | `parseEventText(text, now)`: orquesta y saca el título (RF-9) |
| `src/lib/nl/resolve.ts` | `resolveParsed` → valores del formulario |
| `src/lib/nl/preview.ts` | Texto de la vista previa y tramos resaltados |
| `src/components/calendar/nl-field.tsx` | Campo, vista previa con `aria-live`, "Aplicar" (RF-11, RF-12) |
| `src/components/calendar/quick-create.tsx`, `event-form.tsx` | Montan `NlField` y aceptan los valores |
| `tests/unit/nl-cases.ts` | Batería de frases con fecha fija (`now` = 2026-11-18 10:00 Europe/Madrid) |

## Decisiones

- D1: Analizador por reconocedores con tramos, sin gramática ni librería (chrono no tiene buen español y P6): cada reconocedor es una función pequeña y probada; lo no reconocido queda en el título, que es el fallo menos dañino.
- D2: "Aplicar" en lugar de rellenar en vivo: rellenar los campos mientras se escribe pisaría lo editado y movería el foco; la vista previa en vivo basta para ver qué se entendió.
- D3: Horas ambiguas (RF-15) de la tarde: en una familia, "a las 5" casi siempre es por la tarde; la vista previa lo enseña.
- D4: Repetición solo propuesta (RF-10) con los tipos rápidos de `presets.ts` (013); la regla la resuelve el servidor como siempre.
- D5: Calendario por `matchCalendar` de la 036, que ya está en `lib/assistant/calendar-match.ts` y es puro: se reutiliza sin moverlo.

## Pasos de producción

Ninguno: sin migraciones ni variables.

## Riesgos

- Tildes y mayúsculas: el tokenizador guarda las posiciones en el texto original para resaltar bien.
