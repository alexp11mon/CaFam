# Tasks 027 — Venito y el chat del asistente

Spec y plan aprobados de antemano (2026-11-15).

> Estado: **en curso**.

## Tareas

- [ ] T1 Venito
  Hecho cuando: `npm test -- venito` en verde (seis expresiones, decorativo o con nombre, tokens en los dos temas, sin movimiento con `prefers-reduced-motion`). Cubre: RF-1

- [ ] T2 Sugerencias
  Hecho cuando: `npm test -- assistant-suggestions` en verde. Cubre: RF-5

- [ ] T3 Chat con aspecto de conversación
  Hecho cuando: los tests del chat pasan con la estructura nueva (burbujas con hora, escribiendo con el paso real, barra de entrada, chips) y los existentes siguen cubriendo citas, cancelar, reintentar, cuota, imágenes y propuesta. Cubre: RF-4, RF-5, RF-6, RF-8

- [ ] T4 Botón de Venito y panel
  Hecho cuando: `npm test -- assistant-panel assistant-fab` en verde: abre sin navegar, cierra con botón y Escape, devuelve el foco, conserva la conversación, indica actividad. Cubre: RF-2, RF-3

- [ ] T5 Venito en estados vacíos, errores y sin conexión
  Hecho cuando: sus tests lo comprueban. Cubre: RF-7

- [ ] T6 Capturas, medida y cierre
  Hecho cuando: capturas de CA-2, `measure.mjs` y P8 en verde. Cubre: CA-1, CA-2, CA-3

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T1 |
| RF-5 | T2, T3 |
| RF-4, RF-6, RF-8 | T3 |
| RF-2, RF-3 | T4 |
| RF-7 | T5 |
