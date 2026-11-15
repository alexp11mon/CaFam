# Tasks 025 — Sistema de diseño y marca "Orilla"

Spec y plan aprobados de antemano por el usuario en el prompt de arranque (2026-11-15).

> Estado: **en curso**.

## Tareas

- [ ] T1 Enmienda 10 de la constitución
  Hecho cuando: `docs/constitution.md` tiene la sección de identidad Orilla y la enmienda 10 en su lista. Cubre: RF-1

- [ ] T2 Tokens, acentos y guardias
  Hecho cuando: `accents.ts` y `globals.css` llevan los valores nuevos; `surface`/`surface-float` sustituyen al cristal; `npm test -- accents theme-css design-tokens motion-tokens palette` en verde con las guardias reescritas (contraste en los dos temas y seis acentos; sin `backdrop-filter`). Cubre: RF-2, RF-3, RF-4, RF-9, RF-10, RNF-1

- [ ] T3 Tipografía Figtree
  Hecho cuando: el layout carga Figtree y el test de la fuente lo comprueba. Cubre: RF-5

- [ ] T4 Componentes base
  Hecho cuando: `npm test -- button text-field sheet chip card empty-state icon-button` en verde; todo campo mide 16 px. Cubre: RF-6, RNF-2

- [ ] T5 Marca e iconos
  Hecho cuando: logo nuevo, `scripts/make-icons.mjs` genera los cuatro PNG, manifest con los colores nuevos, `CACHE_NAME` sube y sus tests pasan. Cubre: RF-7

- [ ] T6 Marco de navegación
  Hecho cuando: barra inferior con "+", barra lateral, cabecera y hoja "Más" con sus tests; se retiran el cajón y el botón flotante "+"; pantalla provisional de Notas. Cubre: RF-8, RF-11

- [ ] T7 Capturas, medida y cierre
  Hecho cuando: capturas de CA-2 en `specs/025-sistema-de-diseno-y-marca/capturas/`, `measure.mjs` sin regresión y P8 en verde. Cubre: CA-1, CA-2, CA-3

## Trazabilidad RF → Tareas

| RF | Tarea |
|----|-------|
| RF-1 | T1 |
| RF-2, RF-3, RF-4, RF-9, RF-10 | T2 |
| RF-5 | T3 |
| RF-6 | T4 |
| RF-7 | T5 |
| RF-8 | T6 |
| RF-11 | T2 a T6 |
