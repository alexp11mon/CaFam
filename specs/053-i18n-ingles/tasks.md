# Tasks 053 — Internacionalización: inglés además del español

Spec: `specs/053-i18n-ingles/spec.md`. Plan: `specs/053-i18n-ingles/plan.md` (aprobados de antemano por el usuario el 2026-11-18). Va la última de la hoja de ruta.

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1.

## Tareas

- [ ] T0 Medida de partida
  Hecho cuando: tamaño del JS inicial (`next build`) y cambio de mes con CPU 4× (`scripts/perf/measure.mjs`) anotados en la evidencia.

  Cubre: RNF-1 | Evidencia: —
- [ ] T1 Idioma en el perfil y detección
  Hecho cuando: `npm run test:db -- profile-locale` y `npm test -- i18n-locale i18n-plural i18n-format` en verde.

  Cubre: RF-1, RF-2, RF-4, RF-7 | Evidencia: —
- [ ] T2 Infraestructura y tests de completitud
  Hecho cuando: `npm test -- i18n-complete i18n-no-literals locale-provider` en verde (el de literales empieza con la lista de archivos aún sin migrar y debe acabar vacía).

  Cubre: RF-8, RNF-2 | Evidencia: —
- [ ] T3 Marco, autenticación, ajustes y errores
  Hecho cuando: esas áreas sin literales, sus tests en verde y capturas en inglés.

  Cubre: RF-1, RF-3, RF-6 | Evidencia: —
- [ ] T4 Calendario, eventos, series, comentarios e imágenes
  Hecho cuando: esas áreas sin literales, sus tests en verde y capturas en inglés.

  Cubre: RF-3, RF-4 | Evidencia: —
- [ ] T5 Compartir, importar, sincronización, notas, sin conexión y lo añadido en 039–052
  Hecho cuando: esas áreas sin literales y sus tests en verde.

  Cubre: RF-3 | Evidencia: —
- [ ] T6 Venito y correos
  Hecho cuando: `npm test -- assistant-core assistant-suggestions` en verde con el idioma; correos por idioma probados con `send_pending_emails(p_dry_run)`.

  Cubre: RF-3, RF-5 | Evidencia: —
- [ ] T7 Medida final y cierre
  Hecho cuando: medida de RNF-1 que no empeora (si empeora, se anota y no se integra, RNF-3); AGENTS.md, README y constitución (enmienda de idioma) actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2 | T1, T3 |
| RF-3 | T3 a T6 |
| RF-4 | T1, T4 |
| RF-5 | T6 |
| RF-6, RF-7 | T1, T3 |
| RF-8 | T2 |
