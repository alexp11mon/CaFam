# Spec 029 — Pantallas restantes y cierre

> Estado: **Cerrada** (2026-11-16). Aprobada de antemano por el usuario en el prompt de arranque (2026-11-15). Sexta spec del encargo de rediseño. Sin migraciones ni dependencias. Se cerró junto con la 030, que el usuario pidió mientras esta estaba en curso: las capturas y el recorrido finales son ya con la identidad Nexo.

## Objetivo

Que el resto de pantallas (portada, registro, login, recuperar contraseña, Mis calendarios, crear y editar calendario, categorías, compartir, miembros, unirme, invitación, importar, conexiones, Ajustes, privacidad, sin conexión y errores) queden con el mismo sistema, mismo comportamiento y mejor organización; y cerrar el encargo: auditoría, recorrido completo en móvil, capturas y documentación.

## Requisitos funcionales

- RF-1 Todas las pantallas secundarias usan solo los componentes base y los tokens (las guardias lo comprueban); no queda ningún botón con estilos propios de la identidad anterior.
- RF-2 "Mis calendarios": una acción principal ("Nuevo calendario") y el resto de caminos (importar, unirme, cuentas conectadas, juntar) en una fila de chips que se desplaza en horizontal en el móvil, en lugar de cinco botones apilados.
- RF-3 Venito en la portada, en las pantallas de error y en la de sin conexión (specs 027 y 030).
- RF-4 Logo, favicon, iconos de la PWA, manifest y `CACHE_NAME` actualizados (hechos en las specs 025 y 030).
- RF-5 Recorrido completo en un iPhone emulado, como script reproducible (`scripts/e2e-phone.mjs`): registrarse, crear un calendario, crear y mover un evento, cambiar de vista y de periodo, abrir el asistente y usar una sugerencia, crear una nota y marcar tareas, Ajustes y tema.
- RF-6 Capturas de todas las pantallas secundarias a 390 px (claro) y 1440 px (oscuro).
- RF-7 `AGENTS.md` actualizado: estado de las specs 024 a 030, lo nuevo de cada una, estructura, identidad, rutas, patrones, trampas y "Cómo continuar". Constitución con sus enmiendas 10 y 11.

## Auditoría final (qué se revisó y qué quedó)

| Eje | Resultado |
|-----|-----------|
| Contraste | Comprobado por test en los dos temas y los seis acentos: texto 4,5:1, bordes de control 3:1 y texto sobre los dos extremos de cada degradado 4,5:1 (`accents.test.ts`) |
| Teclado y foco | "Saltar al contenido", foco visible en todos los controles nuevos (navegación, hojas, chips, chat, notas); las hojas y el chat son `<dialog>` modales con Escape y devolución del foco (tests) |
| Lectores de pantalla | Nombres accesibles en botones de icono; regiones `status`/`log`/`alert` en chat, notas y carga del calendario; Venito decorativo salvo en su botón |
| Movimiento | `prefers-reduced-motion` anula los gestos de Venito, el "pop" de las casillas y los tokens de la 021 |
| Móvil | Safe areas en cabecera, navegación flotante, botones flotantes, hojas y chat; campos de 16 px; objetivos de 44 px en la navegación y los componentes base |
| Rendimiento | Sin regresión frente a la 024 (`scripts/perf/results/030.json`) |

Lo que **no** se auditó a fondo y queda dicho: los formularios largos (evento completo, edición de repeticiones, propuesta del asistente) solo heredan el estilo de los tokens y los componentes base, sin rediseño propio de su organización; y no hay prueba con lector de pantalla real ni en Safari.

## Criterios de aceptación

- CA-1 P8 con `test:db` en verde.
- CA-2 `scripts/e2e-phone.mjs` pasa sus ocho pasos.
- CA-3 Capturas en `capturas/`.
