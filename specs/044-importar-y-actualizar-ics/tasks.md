# Tasks 044 — Importar a un calendario existente y actualizar lo importado

Spec: `specs/044-importar-y-actualizar-ics/spec.md`. Plan: `specs/044-importar-y-actualizar-ics/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2 y T4.

## Tareas

- [x] T1 Identidad de cada evento importado
  Hecho cuando: `npm test -- convert-events parse-ics` en verde: `UID` en sueltos, `UID#<instante>` en repeticiones y en repeticiones cambiadas, estable entre dos lecturas del mismo archivo.

  Cubre: RF-2 | Evidencia: `npm test -- parse-ics-identity ics-convert ics-parse ics-import import-action` 80 tests en verde; un `.ics` que repite una identidad conserva la primera y la cuenta como omitida (2026-11-19)
- [x] T2 Importar a un calendario existente
  Hecho cuando: `npm run test:db -- import-into` y `npm test -- import-form import-actions` en verde.
  - Migración (parte de importación), `db:push`, `db:types`. Añade y cuenta los que ya estaban; Lector → error; traído → error; tope de 10.000.
  - Formulario con destino y resumen.

  Cubre: RF-1, RF-3, RF-4 | Evidencia: migración `ics_import_into` aplicada en dev y tipos regenerados; `npm run test:db -- import-into` 4 tests en verde (añade y cuenta los que ya estaban, Lector `CF404`, traído `22023`, tope de 10.000 sin dejar nada); `npm test -- import ics` 270 tests en verde; typecheck y lint sin errores (2026-11-19)
- [x] T3 Motor de actualización
  Hecho cuando: `npm test -- ics-refresh` (dependencias simuladas) en verde.
  - Lee, convierte y aplica; fallo de red → `transient`; 404/410 → `gone`; respeta el plazo de 50 s y las tandas.

  Cubre: RF-7, RF-10, RF-12, RNF-1 | Evidencia: `npm test -- ics-refresh` 7 tests en verde (solo la ventana leída, ventana vacía, red → `transient`, 404/410 → `gone`, archivo inválido y fallo al guardar → `transient`, enlace no https sin descargar, tandas y plazo de 50 s); `fetch-ics` da `gone` con 404/410 y `npm test -- ics import` 278 tests en verde (2026-11-19)
- [x] T4 Suscripciones en la base de datos
  Hecho cuando: `npm run test:db -- ics-subscriptions` en verde.
  - Crear (URL en Vault), solo `created_by` lee la URL, reconciliar (añadir, cambiar, borrar, no pisar lo cambiado en CaFam, no tocar lo propio, conservar color e imágenes), fallos y pausa, pausa al perder el rol, borrado con el calendario.

  Cubre: RF-5, RF-7 a RF-11, RF-13 | Evidencia: migración `ics_subscriptions` aplicada en dev y tipos regenerados; `npm run test:db -- ics-subscriptions` 8 tests en verde (URL en Vault y solo con el secreto, Lector `CF404`, añadir/cambiar/borrar solo lo del enlace conservando el color y lo de otro archivo o propio, no pisa lo cambiado tras la lectura, aviso y pausa al 3.er `gone`, "Reintentar" con 5 minutos, tanda vencida, pausa al pasar a Lector, "Dejar de actualizar" borra el secreto y conserva los eventos, se borra al quedar sin propietario, `pg_cron` cada 15 minutos). La identidad que borra el enlace se guarda en `feed_ids` para no tocar lo importado de otro archivo (2026-11-19)
- [x] T5 Ruta, acciones e interfaz
  Hecho cuando: `npm test -- ics-refresh-route ics-subscription-status` en verde, prueba real con un `.ics` servido en local (cambiarlo y "Actualizar ahora") y capturas a 390 y 1440 px en claro y oscuro.

  Cubre: RF-5, RF-6, RF-10 | Evidencia: `npm test -- ics-refresh-route ics-subscription-status import-form import-action notice-list` en verde y `npm test` 376 archivos, 3.690 tests en verde. Prueba real contra `next start` con el `.ics` público de festivos de España de Google (un `.ics` servido en local lo rechaza la protección anti-SSRF de la 004): importar a "Mi calendario" con "Mantener actualizado" guardó la suscripción con 386 identidades; tras borrar un festivo dentro de la ventana y añadir uno que el enlace ya no tiene, "Actualizar ahora" dio `{added: 1, changed: 0, removed: 1}` y una segunda pulsación "espera unos minutos". Capturas a 390 y 1440 px en claro y oscuro en `capturas/` (`scripts/screenshots-044.mjs`) (2026-11-19)
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-4 | T1, T2 |
| RF-5, RF-6 | T4, T5 |
| RF-7 a RF-13 | T3, T4 |
