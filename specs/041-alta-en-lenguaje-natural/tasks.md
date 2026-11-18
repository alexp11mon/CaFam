# Tasks 041 — Alta de eventos en lenguaje natural

Spec: `specs/041-alta-en-lenguaje-natural/spec.md`. Plan: `specs/041-alta-en-lenguaje-natural/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una. Sin migraciones.

## Tareas

- [ ] T1 Tokenizador y fechas
  Hecho cuando: `npm test -- nl-dates` en verde con al menos 50 frases.
  - Relativas, días de la semana (también hoy y "que viene"), fechas con y sin año, `d/m`, rangos de varios días.

  Cubre: RF-1, RF-2, RF-3, RF-6 | Evidencia: —
- [ ] T2 Horas y duraciones
  Hecho cuando: `npm test -- nl-times` en verde con al menos 50 frases.
  - "y media", "y cuarto", "menos cuarto", franjas, am/pm, rangos, "hasta", duraciones y ambigüedad de la tarde.

  Cubre: RF-4, RF-5, RF-15 | Evidencia: —
- [ ] T3 Lugar, calendario, repetición y título
  Hecho cuando: `npm test -- nl-parse nl-cases` en verde (batería completa, más de 150).
  - "en 2 semanas" no es lugar; "@fam" elige Familia; ambiguo avisa; título limpio con mayúscula.

  Cubre: RF-7 a RF-10, RNF-1, RNF-2 | Evidencia: —
- [ ] T4 Resolución y vista previa
  Hecho cuando: `npm test -- nl-resolve nl-preview` en verde.
  - Valores del formulario en la zona del perfil (también con cambio de hora) y duración de Ajustes; tramos resaltados en el texto original.

  Cubre: RF-11, RF-12 | Evidencia: —
- [ ] T5 Campo en el alta rápida y en el formulario
  Hecho cuando: `npm test -- nl-field quick-create event-form` en verde y capturas a 390 y 1440 px en claro y oscuro en `capturas/`.
  - Vista previa en vivo, `aria-live`, "Aplicar"/Intro, no pisa lo tocado a mano, "+" y N enfocan la frase, funciona en la app sin conexión.

  Cubre: RF-11 a RF-14, RNF-3 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución (hoja de ruta) actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-3, RF-6 | T1 |
| RF-4, RF-5, RF-15 | T2 |
| RF-7 a RF-10 | T3 |
| RF-11 a RF-14 | T4, T5 |
