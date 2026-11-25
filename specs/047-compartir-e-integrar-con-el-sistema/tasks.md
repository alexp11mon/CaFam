# Tasks 047 — Compartir e integrar con el sistema

Spec: `specs/047-compartir-e-integrar-con-el-sistema/spec.md`. Plan: `specs/047-compartir-e-integrar-con-el-sistema/plan.md` (aprobados de antemano por el usuario el 2026-11-18). Depende de la 043 (`write-ics`), la 039 (buscador) y la 041 (frase).

> Estado: pendiente.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T4.

## Tareas

- [x] T1 Compartir un evento
  Hecho cuando: `npm test -- share-text event-ics share-event-button` en verde: texto con y sin lugar, día completo, `.ics` válido, `share` con archivo, sin archivo y sin API (menú).

  Cubre: RF-1 a RF-4 | Evidencia: 2026-11-25, `share-text` 3, `event-ics` 4, `share-event-button` 5 en verde; P8 completa (3.772 tests, build OK).
- [x] T2 Recepción en el service worker
  Hecho cuando: `npm test -- sw-share-target offline-sw-sync` en verde: el `POST` guarda en `cafam-share` y responde `303`; lo caducado se borra; el bucle sin conexión sigue igual. `CACHE_NAME` sube.

  Cubre: RF-5, RF-10, RNF-2 | Evidencia: 2026-11-25, `sw-share-target` 4, `offline-sw-sync`, `sw-push`, `manifest` en verde; `CACHE_NAME` = `cafam-v9`; P8 completa (3.777 tests, build OK).
- [ ] T3 Bandeja de lo compartido
  Hecho cuando: `npm test -- share-inbox import-form next-path` en verde y capturas a 390 px en claro y oscuro.
  - `.ics` → importar; imágenes → Venito o evento; texto → alta; sin sesión → login y vuelta.

  Cubre: RF-6 a RF-9 | Evidencia: —
- [ ] T4 Accesos directos y número del icono
  Hecho cuando: `npm test -- manifest use-app-badge` y `npm run test:db -- profile-badge` en verde; iconos generados.

  Cubre: RF-11 a RF-13 | Evidencia: —
- [ ] T5 Prueba en el navegador y cierre
  Hecho cuando: con `next start -p 3100` y Edge instalado como app, el menú del icono muestra los accesos directos y el número; `share_target` se prueba en Android si hay dispositivo (si no, queda anotado para el usuario). AGENTS.md (trampas de iOS), README y constitución actualizados; `python -m graphify update .`; P8 completa.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-4 | T1 |
| RF-5, RF-10 | T2 |
| RF-6 a RF-9 | T3 |
| RF-11 a RF-13 | T4 |
