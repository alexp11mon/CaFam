# Tasks 041 — Alta de eventos en lenguaje natural

Spec: `specs/041-alta-en-lenguaje-natural/spec.md`. Plan: `specs/041-alta-en-lenguaje-natural/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: cerrada (2026-11-18), T1–T6. Sin pasos de producción.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una. Sin migraciones.

## Tareas

- [x] T1 Tokenizador y fechas
  Hecho cuando: `npm test -- nl-dates` en verde con al menos 50 frases.
  - Relativas, días de la semana (también hoy y "que viene"), fechas con y sin año, `d/m`, rangos de varios días.

  Cubre: RF-1, RF-2, RF-3, RF-6 | Evidencia: `npm test -- nl-dates` 63/63 (57 frases: relativas, días de la semana con "próximo" y "que viene", abreviados, fechas con y sin año, `d/m` en orden español, rangos de varios días, "ayer" marcado como pasado, "por la mañana" no es una fecha y "10-12" sin año tampoco); `normalizeText` conserva la longitud y la ñ; P8 en verde (3.346 tests).
- [x] T2 Horas y duraciones
  Hecho cuando: `npm test -- nl-times` en verde con al menos 50 frases.
  - "y media", "y cuarto", "menos cuarto", franjas, am/pm, rangos, "hasta", duraciones y ambigüedad de la tarde.

  Cubre: RF-4, RF-5, RF-15 | Evidencia: `npm test -- nl-times` 66/66 (63 frases): "a las", "21:30", "21h", "9 de la noche", "y media", "y cuarto", "menos cuarto", mediodía, medianoche, franjas (9, 17 y 21 h), am/pm, rangos ("de 10 a 12", "10-12", "de 9 a 11 de la noche"), "hasta las", duraciones ("1h30", "90 min", "media hora", "una hora y media") y la tarde por defecto entre 1 y 7 marcada para la vista previa; P8 en verde.
- [x] T3 Lugar, calendario, repetición y título
  Hecho cuando: `npm test -- nl-parse nl-cases` en verde (batería completa, más de 150).
  - "en 2 semanas" no es lugar; "@fam" elige Familia; ambiguo avisa; título limpio con mayúscula.

  Cubre: RF-7 a RF-10, RNF-1, RNF-2 | Evidencia: `npm test -- nl-parse` 165/165 sobre la batería `tests/unit/nl-cases.ts` (161 frases: las de la spec, 61 a mano y 100 combinaciones de fecha y hora en los dos órdenes), en menos de 1 ms por frase: "en 2 semanas" no es lugar, lugar hasta la siguiente parte, "@familia" como pista de calendario (no en un correo), repeticiones sencillas ("cada lunes", "todos los días", "de lunes a viernes", "cada mes", "cada año") y título limpio con mayúscula; P8 en verde.
- [x] T4 Resolución y vista previa
  Hecho cuando: `npm test -- nl-resolve nl-preview` en verde.
  - Valores del formulario en la zona del perfil (también con cambio de hora) y duración de Ajustes; tramos resaltados en el texto original.

  Cubre: RF-11, RF-12 | Evidencia: `npm test -- nl-resolve nl-preview` 15/15: valores del formulario con la duración de Ajustes o la dicha, el hueco del formulario si la frase no da fecha ni hora, "hasta las" cuenta hacia atrás, fin al día siguiente pasada la medianoche ("de 22 a 1"), todo el día y varios días, `@calendario` con `matchCalendar` (ambiguo, solo lectura y desconocido avisan), cambio de hora en Europe/Madrid (las 2:30 que no existen pasan a las 3:30 con aviso; las que se repiten se conservan), repetición propuesta; vista previa ("Dentista · Jueves, 19 de noviembre · 10:30–11:30 · Calle Mayor · @Familia") y tramos resaltados sobre el texto original; P8 en verde.
- [x] T5 Campo en el alta rápida y en el formulario
  Hecho cuando: `npm test -- nl-field quick-create event-form` en verde y capturas a 390 y 1440 px en claro y oscuro en `capturas/`.
  - Vista previa en vivo, `aria-live`, "Aplicar"/Intro, no pisa lo tocado a mano, "+" y N enfocan la frase, funciona en la app sin conexión.

  Cubre: RF-11 a RF-14, RNF-3 | Evidencia: `npm test -- nl-field quick-create event-form offline-app` en verde: `NlField` ("Escribe el evento") con vista previa en vivo en una región `aria-live="polite"`, lo reconocido subrayado (no solo color), avisos (tarde por defecto, calendario desconocido), "Aplicar" o Intro sin enviar el formulario y sin mandar la frase; en el alta rápida rellena título, día, horas, calendario, lugar y repetición, y en el formulario completo todos los campos (también "Todo el día" y "Repetir") sin pisar los tocados a mano; el "+", N y la ventana empiezan en la frase; en la app sin conexión funciona igual. Capturas en `capturas/` (`formulario-frase`, `formulario-aplicado` y `alta-rapida-frase`, 390 y 1440 px, claro y oscuro, con `scripts/screenshots-041.mjs`). P8 en verde (3.602 tests).
- [x] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución (hoja de ruta) actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: AGENTS.md (tabla de specs, sección de la 041, estructura con `lib/nl/` y fuera de alcance), README (estado, "Alta en lenguaje natural", hoja de ruta y fuera de alcance) y constitución (hoja de ruta: la 041 deja de ser futura); `python -m graphify update .`; P8 en verde.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-3, RF-6 | T1 |
| RF-4, RF-5, RF-15 | T2 |
| RF-7 a RF-10 | T3 |
| RF-11 a RF-14 | T4, T5 |
