# Tasks 044 — Importar a un calendario existente y actualizar lo importado

Spec: `specs/044-importar-y-actualizar-ics/spec.md`. Plan: `specs/044-importar-y-actualizar-ics/plan.md` (aprobados de antemano por el usuario el 2026-11-18).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T2 y T4.

## Tareas

- [ ] T1 Identidad de cada evento importado
  Hecho cuando: `npm test -- convert-events parse-ics` en verde: `UID` en sueltos, `UID#<instante>` en repeticiones y en repeticiones cambiadas, estable entre dos lecturas del mismo archivo.

  Cubre: RF-2 | Evidencia: —
- [ ] T2 Importar a un calendario existente
  Hecho cuando: `npm run test:db -- import-into` y `npm test -- import-form import-actions` en verde.
  - Migración (parte de importación), `db:push`, `db:types`. Añade y cuenta los que ya estaban; Lector → error; traído → error; tope de 10.000.
  - Formulario con destino y resumen.

  Cubre: RF-1, RF-3, RF-4 | Evidencia: —
- [ ] T3 Motor de actualización
  Hecho cuando: `npm test -- ics-refresh` (dependencias simuladas) en verde.
  - Lee, convierte y aplica; fallo de red → `transient`; 404/410 → `gone`; respeta el plazo de 50 s y las tandas.

  Cubre: RF-7, RF-10, RF-12, RNF-1 | Evidencia: —
- [ ] T4 Suscripciones en la base de datos
  Hecho cuando: `npm run test:db -- ics-subscriptions` en verde.
  - Crear (URL en Vault), solo `created_by` lee la URL, reconciliar (añadir, cambiar, borrar, no pisar lo cambiado en CaFam, no tocar lo propio, conservar color e imágenes), fallos y pausa, pausa al perder el rol, borrado con el calendario.

  Cubre: RF-5, RF-7 a RF-11, RF-13 | Evidencia: —
- [ ] T5 Ruta, acciones e interfaz
  Hecho cuando: `npm test -- ics-refresh-route ics-subscription-status` en verde, prueba real con un `.ics` servido en local (cambiarlo y "Actualizar ahora") y capturas a 390 y 1440 px en claro y oscuro.

  Cubre: RF-5, RF-6, RF-10 | Evidencia: —
- [ ] T6 Cierre
  Hecho cuando: AGENTS.md, README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-4 | T1, T2 |
| RF-5, RF-6 | T4, T5 |
| RF-7 a RF-13 | T3, T4 |
