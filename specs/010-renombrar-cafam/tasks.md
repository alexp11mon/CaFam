# Tasks 010 - Renombrar el proyecto a CaFam

> Estado: **Aprobadas** por el usuario (2026-10-29).
> Spec: `specs/010-renombrar-cafam/spec.md` (aprobada el 2026-10-29). Plan: `specs/010-renombrar-cafam/plan.md` (aprobado el 2026-10-29).
> 8 tareas en una sola iteración.
> Reglas:
>
> - Una tarea cada vez, con el test primero (rojo → verde).
> - Al cerrar cada tarea se ejecuta y se reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Si toca esquema o datos, también `npm run test:db -- <filtro>`.
> - Si toca interfaz: capturas a 390, 768 y 1440 px con el acento rojo y el amarillo (P9). El tema oscuro llega con la 011.
> - Un commit por tarea, citándola, en la rama `010-renombrar-cafam`. El primer commit lleva `plan.md` y `tasks.md`.
>
> Sin dependencias nuevas (P6): solo cambia el campo `name` de `package.json` y `package-lock.json`.
> Migraciones: solo nuevas, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario (plan, "Pasos fuera del repositorio").
> "Nombres antiguos" = las cadenas de RF-10, buscadas sin distinguir mayúsculas.

## Tareas

- [x] T1 Redefinir con el nombre CaFam las dos funciones de correo
  Pasos:
  - Primero los tests en rojo:
    - Test unitario `tests/unit/rename-migration.test.ts`: lee `supabase/migrations/20261029130000_rename_cafam.sql` y comprueba que existe, que el `sender` lleva `'CaFam'` y que no contiene ningún nombre antiguo.
    - Ampliación de `tests/integration/account-delete.test.ts`, que ya lee `email_outbox`: al borrar una cuenta con un calendario compartido, el `body` de `email_outbox` del miembro contiene "CaFam" y ningún nombre antiguo.
  - Después la migración `rename_cafam`, según D1. Copia literal de `delete_own_account()` y `send_pending_emails(boolean, integer)` desde su última versión, cambiando solo el nombre. Repite los `revoke`/`grant`.
  - Comprobar con `diff` que solo cambian esas líneas (R1). Aplicar con `npm run db:push` y regenerar con `npm run db:types`.

  Hecho cuando: `npm test -- rename-migration` y `npm run test:db -- account` en verde, y `src/types/database.ts` sin cambios. Cubre: RF-7, RF-8, RF-9, RF-19 (en dev) | Módulo: mail-rename
  Evidencia (2026-10-29): rojo antes de la migración (archivo inexistente; `body` sin "de CaFam."). `diff` con las versiones anteriores: solo las 3 líneas del nombre, la cabecera y los `grant`. Migración aplicada en dev, tipos sin cambios. `rename-migration` 2/2, `test:db -- account` 10 archivos y 62 tests, typecheck, lint y format en verde, `npm test` 146 archivos y 1281 tests, y build correcto.

- [x] T2 Mostrar CaFam en la interfaz, la PWA y la descarga `.ics`
  Pasos:
  - Primero, en rojo:
    - `manifest.test.ts`: `name` y `short_name` "CaFam".
    - `side-rail.test.tsx`: enlace de inicio con nombre "CaFam".
    - `brand-icons.test.ts`: `CACHE_NAME = "cafam-v3"`, y el monograma "CF" sin cambios (RF-4).
    - `smoke.test.ts`: con el texto nuevo.
  - Después, los archivos del módulo `brand-text`, más `public/sw.js` y `src/lib/ics/fetch-ics.ts` (`CaFam-import`), incluidos sus comentarios.

  Hecho cuando: `npm test -- manifest side-rail brand-icons smoke ics` en verde, y `git grep -i -E` con los nombres antiguos sin resultados en `src/` ni en `public/`. Cubre: RF-2, RF-3, RF-4, RF-5, RF-6 | Módulo: brand-text, sw-cache, ics-agent
  Evidencia (2026-10-29): rojo en 3 tests (manifest, side-rail, brand-icons). Después: 14 archivos y 218 tests en verde con el filtro; sin nombres antiguos en `src/` ni en `public/`; typecheck, lint y format en verde; `npm test` 146 archivos y 1281 tests; build correcto.

- [x] T3 Poner el nombre técnico `cafam` en la configuración del repositorio
  Pasos:
  - `package.json` y los dos `name` de `package-lock.json` a `cafam`.
  - `supabase/config.toml` con `project_id = "cafam"` (D5).
  - Comprobar que `npm ci --dry-run` no cambia dependencias.

  Hecho cuando: `npm run build` en verde, y `git grep -i -E` con los nombres antiguos sin resultados en `package.json`, `package-lock.json` ni `supabase/config.toml`. Cubre: RF-10 (configuración) | Módulo: repo-config
  Evidencia (2026-10-29): `npm ci --dry-run` "up to date" (sin cambios de dependencias); sin nombres antiguos en los tres archivos; typecheck, lint y format en verde; `npm test` 1281 tests; build correcto.

- [x] T4 Generar los datos de prueba con el dominio `@cafam.test`
  Pasos:
  - `uniqueEmail()` y `deleteTestMail()` de `tests/integration/helpers.ts`. Este último sigue limpiando también el dominio antiguo hasta T5, para no dejar correo huérfano, y se queda solo con el nuevo al cerrar T5.
  - `account-jobs.test.ts`.
  - Origen `https://cafam.test` en `account-confirm.test.ts` y `oauth-routes.test.ts` (D8).

  Hecho cuando: `npm test` y `npm run test:db` en verde. Si salta el límite de Auth, se repite con `--no-file-parallelism` (trampa conocida). Cubre: RF-15 | Módulo: test-data
  Evidencia (2026-10-29): `npm test` 1281 tests en verde. `test:db` completo por tandas de 6 archivos (el límite de inicios de sesión de Supabase dev cortaba incluso la ejecución en serie): 33 archivos y 323 de 324 tests en verde. El que falla, `invites.test.ts` ("returns a 43 character token"), espera ≤ 7 días y recibe 7,0000057: el reloj local va 0,5 s por detrás del de la base de datos (trampa conocida del reloj). Ese test no depende del nombre; corregirlo queda fuera de esta spec. `deleteTestMail()` pasó directamente a `@cafam.test`, porque la T5 limpia el correo del dominio antiguo.

- [x] T5 Borrar de dev los usuarios de prueba antiguos
  Pasos:
  - Escribir el script del scratchpad `cleanup-old-test-users.mjs` según el contrato del plan. Se niega a seguir sin la referencia de dev y nunca imprime las claves.
  - Ejecutarlo con `--dry-run`, reportar el número y después ejecutarlo de verdad (D9). El usuario ya lo aprobó el 2026-10-29.
  - Borrar el correo en cola del dominio antiguo y dejar `deleteTestMail()` solo con `@cafam.test`.

  Hecho cuando: una segunda ejecución con `--dry-run` reporta 0 usuarios y 0 correos en cola, y `npm run test:db -- account` sigue en verde. Cubre: RF-16 | Módulo: dev-cleanup
  Evidencia (2026-10-29): simulación: 196 usuarios y 0 correos en cola. Ejecución: 196 borrados. Segunda simulación: 0 y 0. Después, `test:db` de la T4 en verde, incluidas las tandas `account-*`.

- [x] T6 Poner al día `AGENTS.md` con el nombre único, la enmienda 3 y las specs 010 a 015
  Pasos: aplicar D7.
  - Título, §1 y el repositorio nuevo `alexp11mon/CaFam`.
  - Tabla de §2 con las specs 010 a 015.
  - En §3, el resumen de P9 tras la enmienda.
  - En §6, `cafam-v3`.
  - En §10 y §12, los usuarios de prueba borrados y la siguiente spec.
  - En §11, sin lo que ya tiene spec.
  - El bloque de `next dev` no se toca (R7).

  Hecho cuando: `git grep -i -E` con los nombres antiguos sin resultados en `AGENTS.md`, y en el diff de `AGENTS.md` aparecen las specs 010 a 015 y la enmienda 3. Cubre: RF-13 | Módulo: docs-rename
  Evidencia (2026-10-29): sin nombres antiguos en `AGENTS.md`; el diff añade las filas 010 a 015, el resumen de la enmienda 3, `cafam-v3`, la migración `rename_cafam`, §11 y §12 al día. El bloque de `next dev` no cambia. Solo documentación: no aplica la verificación de código.

- [x] T7 Impedir que vuelvan los nombres antiguos y renombrar el resto de la documentación
  Pasos:
  - Primero, `tests/unit/project-name.test.ts` según D2 (con `git ls-files`, las cadenas montadas por trozos y la lista explícita de excepciones). Se ejecuta en rojo y debe listar solo `README.md`, `docs/constitution.md` y las specs 001 a 009.
  - Después, `README.md`.
  - La frase de la constitución según D6.
  - Las specs cerradas con el script de Python de D4, revisando `git diff --word-diff specs/00*`: solo cambian nombres (RF-12).

  Hecho cuando: `npm test -- project-name` en verde después de haber fallado con esa lista, y `invite-url.test.ts` sin cambios con la URL de Vercel (RF-11). Cubre: RF-10, RF-11, RF-12, RF-14 | Módulo: name-guard, docs-rename
  Evidencia (2026-10-29): la guardia falló primero con `README.md`, `docs/constitution.md` y las specs 001, 003, 004 y 005 (25 líneas). `git diff --word-diff` solo muestra cambios de nombre (y la frase de la constitución de D6). Después, `project-name` e `invite-url` en verde, con `invite-url.test.ts` sin cambios.

- [ ] T8 Validar el cambio de nombre en el navegador y preparar los pasos externos
  Pasos:
  - Ejecutar `npm run build` y `npx next start -p 3100` y comprobar con `playwright-cli`:
    - `<title>` "CaFam" en `/` y "Ajustes · CaFam" en `/dashboard/settings` (RF-1, D11);
    - el logotipo, la barra lateral y `/privacy`;
    - `/manifest.webmanifest`;
    - `sw.js` con `cafam-v3`.
  - Capturas a 390, 768 y 1440 px con el acento rojo y el amarillo. El usuario de prueba se borra al terminar, y también la carpeta `.playwright-cli/`.
  - Verificación obligatoria completa.
  - Entregar al usuario los pasos 1 a 6 de "Pasos fuera del repositorio" del plan, y anotar en este archivo lo que confirme.

  Hecho cuando: las comprobaciones del navegador son correctas con sus capturas, la verificación obligatoria está en verde con su salida reportada, y el usuario confirma los pasos de RF-17 a RF-20: consulta de prod en 0 o informada, migración en prod, paneles revisados y repositorio renombrado con Vercel desplegando. Cubre: RF-1, RF-3, RF-17, RF-18, RF-19, RF-20 | Módulo: prod-steps

## Trazabilidad RF -> Tareas

- RF-1 -> T8
- RF-2 -> T2
- RF-3 -> T2, T8
- RF-4 -> T2
- RF-5 -> T2
- RF-6 -> T2
- RF-7 -> T1
- RF-8 -> T1
- RF-9 -> T1
- RF-10 -> T3, T7
- RF-11 -> T7
- RF-12 -> T7
- RF-13 -> T6
- RF-14 -> T7
- RF-15 -> T4
- RF-16 -> T5
- RF-17 -> T8
- RF-18 -> T8
- RF-19 -> T1 (dev), T8 (prod)
- RF-20 -> T8

## Módulos -> Tareas

- mail-rename -> T1
- brand-text, sw-cache, ics-agent -> T2
- repo-config -> T3
- test-data -> T4
- dev-cleanup -> T5
- docs-rename -> T6, T7
- name-guard -> T7
- prod-steps -> T8

## Dudas abiertas

- Ninguna.
