# Tareas 032 — Panel lateral desplazable y calendarios plegables

> Aprobadas de antemano por el usuario junto con la spec (2026-11-17).

- [x] T1 Panel lateral con alto máximo y desplazamiento propio (RF-1, RF-2, D1). Test: el panel lleva las clases de alto máximo y desplazamiento.
- [x] T2 `folded.ts` y `use-folded.ts` (RF-6, D2). Tests de lectura tolerante, escritura y sin `localStorage`.
- [x] T3 Filtros plegables y modo "Ordenar" (RF-3 a RF-9, D3). Tests de plegar sin cambiar la visibilidad, recordar, resumen, categorías plegadas y ordenar.
- [x] T4 "Mis calendarios" más ligero (RF-10 a RF-14, D4). Tests de grupos plegables, menú de opciones, filas que se despliegan y "Nuevo grupo" en hoja.
- [x] T5 Verificación completa, capturas a 390/768/1440 en claro y oscuro y AGENTS.md.

## Evidencia

- `npm run typecheck`, `npm run lint` (0 errores; el aviso previo de `event-form.tsx`), `npm run format:check` y `npm test` (288 archivos, 2.781 tests) correctos; `npm run build` correcto.
- Sin `test:db`: ninguna tarea toca esquema, RLS ni acceso a datos.
- Prueba en navegador contra un Supabase local con un usuario sembrado (grupos "Universidad" y "Personal", categorías): a 1440×760 el panel mide 1024 px de contenido en 520 visibles y se desplaza con la rueda hasta el final (`scrollTop` 504); plegar, "Ordenar"/"Hecho", la hoja del móvil, filas y "Opciones" de "Mis calendarios" y "Nuevo grupo" en hoja, en claro y oscuro a 390, 768 y 1440 px. Capturas en `capturas/`.
