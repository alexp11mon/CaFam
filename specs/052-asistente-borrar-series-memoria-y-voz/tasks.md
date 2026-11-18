# Tasks 052 — Asistente: borrar, crear series, conversaciones guardadas y voz

Spec: `specs/052-asistente-borrar-series-memoria-y-voz/spec.md`. Plan: `specs/052-asistente-borrar-series-memoria-y-voz/plan.md` (aprobados de antemano por el usuario el 2026-11-18). Depende de la 046.

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2, T3 y T5.

## Tareas

- [ ] T1 Intención, esquemas y reglas
  Hecho cuando: `npm test -- assistant-write-intent assistant-write-schemas recurrence-rule assistant-core` en verde: verbos de borrar y repetir, 1–3, `ruleFromFields` (semanal con días, laborables, hasta, número), prompt con la regla de confirmar.

  Cubre: RF-1, RF-5 | Evidencia: —
- [ ] T2 Proponer y confirmar borrados
  Hecho cuando: `npm test -- assistant-writes assistant-write-actions` y `npm run test:db -- assistant-writes` en verde: Lector sin tarjeta, alcance y pérdida en una repetición, confirmar usa la papelera, deshacer restaura, traído escribe primero en el proveedor (simulado).

  Cubre: RF-1 a RF-4 | Evidencia: —
- [ ] T3 Proponer y confirmar series
  Hecho cuando: los mismos tests con casos de serie en verde: resumen en español y 3 fechas, traído rechazado, regla inválida rechazada.

  Cubre: RF-5 a RF-8 | Evidencia: —
- [ ] T4 Tarjetas
  Hecho cuando: `npm test -- action-card assistant-chat` en verde ("sí"/"no", alcance) y capturas con `scripts/assistant-cards.mjs` ampliado.

  Cubre: RF-2, RF-6 | Evidencia: —
- [ ] T5 Conversaciones guardadas
  Hecho cuando: `npm run test:db -- assistant-conversations` (RLS, tope de 50, caducidad) y `npm test -- conversation-list chat-menu assistant-chat` en verde; capturas.

  Cubre: RF-9 a RF-12 | Evidencia: —
- [ ] T6 Voz
  Hecho cuando: `npm test -- speech mic-button use-speak-answers` en verde con las APIs simuladas (soporte, sin soporte, error de permiso, parar) y prueba en Edge y Chrome reales.

  Cubre: RF-13 a RF-15, RNF-2 | Evidencia: —
- [ ] T7 Evaluación
  Hecho cuando: `EVAL_PART=write EVAL_ONLY=<nuevas> npm run eval:assistant` contra Groq y dev con el 90 % (una ejecución; usuarios `@cafam.test` borrados).

  Cubre: RF-16 | Evidencia: —
- [ ] T8 Cierre
  Hecho cuando: AGENTS.md (§11 y sección), README, constitución y `/privacy` actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-4 | T1, T2, T4 |
| RF-5 a RF-8 | T1, T3, T4 |
| RF-9 a RF-12 | T5 |
| RF-13 a RF-15 | T6 |
| RF-16 | T7 |
