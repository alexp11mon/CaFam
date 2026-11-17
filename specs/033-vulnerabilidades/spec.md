# Spec 033 — Corregir las vulnerabilidades de las dependencias

> Estado: **Cerrada** (2026-11-17). **Aprobada** por el usuario con su petición del 2026-11-17 ("Quiero arreglar esa vulnerabilidad. Esa y todas las que se pueda"), como la 031. Sin dependencias nuevas (P6): solo versiones de parche de las que ya hay.

## Contexto

`npm audit` daba 8 vulnerabilidades moderadas:

- **`next` 16.4.2** (rango afectado 16.3.0–16.4.4): GHSA-mfr8-8qww-v76h, revelación de información entre `root params` cuando una función `'use cache'` se llama a través de `unstable_cache()`. CaFam no usa `unstable_cache`, pero la versión es vulnerable y `next build` lo avisaba en cada compilación.
- **`minimatch` 10.2.6** (7.0.0–11.0.0), denegación de servicio por amplificación de `globparts`, que arrastraba a `typescript-eslint` y sus paquetes `@typescript-eslint/*` (≤ 8.72.2). Solo herramientas de desarrollo (ESLint), nunca en producción.

## Requisitos

- RF-1 `next` y `eslint-config-next` pasan a **16.4.6** (versión exacta, como antes).
- RF-2 Las dependencias de desarrollo transitivas se actualizan con `npm audit fix` (sin `--force`): `typescript-eslint` 8.73.0 y `minimatch` 11.0.9.
- RF-3 `npm audit` termina con **0 vulnerabilidades** y todo lo de P8 sigue pasando.

## Tareas

- [x] T1 Subir las versiones, `npm audit fix` y verificación completa.

## Evidencia

- `npm audit`: `found 0 vulnerabilities`.
- `package.json`: solo cambian `next` y `eslint-config-next` (16.4.2 → 16.4.6). En `package-lock.json`, además, `typescript-eslint` y `@typescript-eslint/*` 8.72.0 → 8.73.0, `minimatch` (el de `typescript-estree`) 10.2.6 → 11.0.9 y otros parches de herramientas.
- `npm run typecheck`, `npm run lint` (0 errores; el aviso previo de `event-form.tsx`), `npm run format:check`, `npm test` (288 archivos, 2.781 tests) y `npm run build` correctos; el build ya no muestra el aviso de seguridad.
- Prueba en navegador contra un Supabase local: inicio de sesión, agenda con el panel lateral y "Mis calendarios" funcionan con 16.4.6.
