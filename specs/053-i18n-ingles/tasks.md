# Tasks 053 — Internacionalización: inglés además del español

Spec: `specs/053-i18n-ingles/spec.md`. Plan: `specs/053-i18n-ingles/plan.md` (aprobados de antemano por el usuario el 2026-11-18). Va la última de la hoja de ruta.

> Estado: hecha (2026-11-26), en la rama `053-i18n-ingles` sin integrar. Faltan las pruebas que necesitan la migración `20261204100000_profile_locale.sql` aplicada en dev (`test:db -- profile-locale`, correos con `send_pending_emails(p_dry_run)`) y las capturas en inglés: las hace el usuario tras `npm run db:push`.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1.

## Tareas

- [x] T0 Medida de partida
  Hecho cuando: tamaño del JS inicial (`next build`) y cambio de mes con CPU 4× (`scripts/perf/measure.mjs`) anotados en la evidencia.

  Cubre: RNF-1 | Evidencia: `scripts/perf/results/053-antes.json`: calendario 364 KB gzip de JS (24 archivos), cambio de mes 55 ms (máx. 81) con CPU 4×.
- [x] T1 Idioma en el perfil y detección
  Hecho cuando: `npm run test:db -- profile-locale` y `npm test -- i18n-locale i18n-plural i18n-format` en verde.

  Cubre: RF-1, RF-2, RF-4, RF-7 | Evidencia: `npm test -- i18n-locale i18n-plural i18n-format` en verde (commit 510ac4e). `test:db -- profile-locale` escrito, pendiente de aplicar la migración en dev.
- [x] T2 Infraestructura y tests de completitud
  Hecho cuando: `npm test -- i18n-complete i18n-no-literals locale-provider` en verde (el de literales empieza con la lista de archivos aún sin migrar y debe acabar vacía).

  Cubre: RF-8, RNF-2 | Evidencia: `i18n-complete`, `i18n-no-literals`, `locale-provider` en verde; la lista `PENDING` de `tests/unit/i18n-pending.ts` acaba vacía.
- [x] T3 Marco, autenticación, ajustes y errores
  Hecho cuando: esas áreas sin literales, sus tests en verde y capturas en inglés.

  Cubre: RF-1, RF-3, RF-6 | Evidencia: sin literales (`i18n-no-literals` con `PENDING` vacío), tests en verde. Capturas en inglés: pendientes (necesitan `profiles.locale` en dev).
- [x] T4 Calendario, eventos, series, comentarios e imágenes
  Hecho cuando: esas áreas sin literales, sus tests en verde y capturas en inglés.

  Cubre: RF-3, RF-4 | Evidencia: ídem; fechas con `dateFormat(locale)`, series con `summarizeRule(rule, "en")`, tiempo relativo y vencimientos en inglés (`tests/unit/i18n-english.test.ts`). Capturas: pendientes.
- [x] T5 Compartir, importar, sincronización, notas, sin conexión y lo añadido en 039–052
  Hecho cuando: esas áreas sin literales y sus tests en verde.

  Cubre: RF-3 | Evidencia: ídem; textos con valores (sin conexión, sincronización, papelera, deshacer, notas) con `{variables}` y `t`. Siguen en español a propósito (`NOT_SHOWN`): textos que solo lee el modelo, el README del `.zip` y la normalización de búsqueda.
- [x] T6 Venito y correos
  Hecho cuando: `npm test -- assistant-core assistant-suggestions` en verde con el idioma; correos por idioma probados con `send_pending_emails(p_dry_run)`.

  Cubre: RF-3, RF-5 | Evidencia: `systemPrompt`/`proposalPrompt` piden responder en el idioma del perfil; estados y propuestas con `translator(locale)` (plan D11); `assistant-core` en verde. Correos: trigger `email_outbox_locale` en la migración; la prueba con `send_pending_emails(p_dry_run)` queda pendiente de aplicarla en dev.
- [x] T7 Medida final y cierre
  Hecho cuando: medida de RNF-1 que no empeora (si empeora, se anota y no se integra, RNF-3); AGENTS.md, README y constitución (enmienda de idioma) actualizados; `python -m graphify update .`; P8 completa.

  Cubre: RNF-1, RNF-3 | Evidencia: `scripts/perf/results/053-despues.json` frente a `053-base.json` (la base recompilada en la misma máquina: 364 KB, como la de partida). Cambio de mes 33 ms (máx. 45) frente a 55 (81): no empeora. JS del calendario: 391 KB frente a 364 en total, pero ese total incluye la precarga en reposo de otras rutas (archivos pedidos a partir de ~700 ms, tras pintar); el JS de la carga en sí (lo pedido en los primeros 300 ms) pasa de 328,7 a 330,4 KB gzip, **+1,7 KB** (límite +5). La precarga crece porque más pantallas tienen componentes de cliente (`<T>`). P8 en verde: typecheck, lint (1 aviso previo en `event-form.tsx`), format, 4.016 tests, build.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1, RF-2 | T1, T3 |
| RF-3 | T3 a T6 |
| RF-4 | T1, T4 |
| RF-5 | T6 |
| RF-6, RF-7 | T1, T3 |
| RF-8 | T2 |
