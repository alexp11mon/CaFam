# Tasks 037 — El "+" no tapa el botón Enviar del chat

Spec y plan: `specs/037-boton-crear-en-el-chat/` (aprobados por el usuario el 2026-11-18).

> Estado: **hecha** (T1), 2026-11-18. Falta el cierre del usuario.

- [x] T1 Ocultar el "+" flotante en la pantalla del asistente y ajustar su alto
  Hecho cuando: `npm test -- app-frame` en verde, con el test primero en rojo. En `/dashboard/assistant` hay un solo enlace "Nuevo evento" (el de la barra superior) y en el calendario siguen los dos. Capturas a 390, 768 y 1440 px en claro y oscuro donde "Enviar" se ve entero. P8 completa. Cubre: RF-1, RF-2, RF-3, RF-4 | Módulo: create-fab (D1), assistant page (D2)
  Evidencia (2026-11-18):
  - `app-frame` (1 test nuevo: en el asistente queda un solo "Nuevo evento", el de la barra superior) y `assistant-page` (1 nuevo: sin `lg:h-dvh`) en verde, los dos primero en rojo.
  - RF-4 apareció al revisar las capturas: a 1440 px la barra de entrada quedaba cortada por abajo.
  - 12 capturas de `/dashboard/assistant` en `capturas/` (390, 768 y 1440 px; claro y oscuro; Violeta y Ámbar) con "Enviar" entero en todas. A 390 px en el calendario el "+" sigue en su sitio (comprobado con una captura de la agenda).
  - P8 en verde: typecheck, lint 0 errores (1 aviso previo), format:check, `npm test` 299 archivos y 2.934 tests, build. Sin `test:db`: no toca datos.
