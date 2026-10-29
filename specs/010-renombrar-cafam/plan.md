# Plan 010 — Renombrar el proyecto a CaFam

Spec de origen: `specs/010-renombrar-cafam/spec.md` (aprobada el 2026-10-29). Plan aprobado el 2026-10-29. Constitución: `docs/constitution.md` (enmienda 3).

## Resumen de arquitectura

No cambia la arquitectura: es una sustitución de texto en la interfaz, la PWA, la configuración, los tests y la documentación. Hay tres piezas nuevas:

- una migración que redefine las dos funciones de Postgres que llevan el nombre antiguo dentro de un texto;
- un test de guardia que impide que el nombre antiguo vuelva;
- un script de limpieza de un solo uso para los usuarios de prueba antiguos de dev.

Las acciones sobre GitHub, producción y los paneles las ejecuta el usuario con los pasos preparados en este plan.

En este plan, "los nombres antiguos" son las cadenas que prohíbe RF-10: `CalendarioFamilia`, `CalenderFam`, `calenderfam` y `calendariofamilia`, buscadas sin distinguir mayúsculas.

```
interfaz y PWA ──── src/app, src/components, public/sw.js ─────── RF-1..RF-6
correo ──────────── migración rename_cafam (Postgres) ────────── RF-7..RF-9, RF-19
repo y docs ─────── package*.json, config.toml, AGENTS, specs ─── RF-10..RF-13
guardia ─────────── tests/unit/project-name.test.ts ──────────── RF-10, RF-14
datos de prueba ─── tests/integration + script de limpieza ───── RF-15..RF-17
fuera del repo ──── GitHub, prod, paneles (usuario) ──────────── RF-18..RF-20
```

## Módulos y responsabilidades

| Módulo | Archivos | Qué hace | Qué no hace | RF |
|--------|----------|----------|-------------|----|
| `brand-text` | `src/app/layout.tsx`, `src/app/manifest.ts`, `src/components/brand/logo.tsx`, `src/components/shell/side-rail.tsx`, `src/components/pwa/ios-install-hint.tsx`, `src/app/privacy/page.tsx` | Muestra "CaFam" en el título, el manifest, el logotipo, la barra lateral, la ayuda de iOS y la política de privacidad | No toca el monograma "CF" ni los iconos | RF-1, RF-2, RF-3, RF-4 |
| `sw-cache` | `public/sw.js` | `CACHE_NAME` pasa a `cafam-v3`; el `activate` que ya existe borra la caché con otro nombre | No cambia qué se cachea | RF-5 |
| `ics-agent` | `src/lib/ics/fetch-ics.ts` | El agente de usuario de la descarga pasa a `CaFam-import` | No cambia la defensa contra SSRF | RF-6 |
| `mail-rename` | `supabase/migrations/20261029130000_rename_cafam.sql` | Hace `create or replace` de `delete_own_account()` y de `send_pending_emails(boolean, integer)` copiando su última versión (`20261024120000_delete_own_account.sql` y `20261024180000_skip_test_addresses.sql`). Solo cambia el nombre en el texto del aviso y en `sender.name`, y vuelve a aplicar los mismos `revoke`/`grant` | No edita migraciones aplicadas. No reescribe filas de `email_outbox` | RF-7, RF-8, RF-9, RF-19 |
| `repo-config` | `package.json`, `package-lock.json` (los dos campos `name`), `supabase/config.toml` (`project_id = "cafam"`) | Pone el nombre técnico en minúsculas | No cambia dependencias ni el proyecto enlazado | RF-10 |
| `docs-rename` | `README.md`, `AGENTS.md`, `docs/constitution.md`, `specs/001` a `specs/009` | Sustituye el nombre. `AGENTS.md` se pone al día con la enmienda 3 y las specs 010 a 015 (D7). La constitución nombra los nombres antiguos refiriéndose a esta spec, sin escribirlos (D6) | No cambia requisitos, decisiones, tareas ni evidencias de las specs cerradas | RF-10, RF-11, RF-12, RF-13 |
| `name-guard` | `tests/unit/project-name.test.ts` | Recorre `git ls-files` y falla si un archivo contiene un nombre antiguo, salvo las excepciones de D2 | No mira archivos sin versionar (`.env*`, `.next/`, `node_modules/`) | RF-10, RF-14 |
| `test-data` | `tests/integration/helpers.ts` (`uniqueEmail`, `deleteTestMail`), `tests/integration/account-jobs.test.ts`, `tests/unit/account-confirm.test.ts`, `tests/unit/oauth-routes.test.ts`, `tests/unit/manifest.test.ts`, `tests/unit/side-rail.test.tsx`, `tests/unit/brand-icons.test.ts`, `tests/unit/smoke.test.ts` | Dominio `@cafam.test`, origen `https://cafam.test` y nombre esperado "CaFam" | No cambia lo que comprueban | RF-15 |
| `dev-cleanup` | Script de un solo uso en el scratchpad (no se versiona) | Borra de dev los usuarios `@calenderfam.test` y su correo en cola (D9) | Nunca se conecta a prod | RF-16, RF-17 |
| `prod-steps` | Sección "Pasos fuera del repositorio" de este plan | Comandos y pasos exactos para el usuario | El agente no los ejecuta | RF-17, RF-18, RF-19, RF-20 |

## Modelo de datos

- **Sin tablas ni columnas nuevas.** La migración `rename_cafam` solo redefine dos funciones; `src/types/database.ts` no cambia, y aun así se regenera con `npm run db:types` para comprobarlo.
- **Textos que cambian dentro de Postgres:**
  - En `delete_own_account()`, el cuerpo del correo pasa a "%s ha eliminado su cuenta de CaFam. … Entra en CaFam, en Mis calendarios." (RF-8).
  - En `send_pending_emails()`, `sender.name` pasa a `'CaFam'` (RF-7). Como el remitente se fija al enviar, los correos pendientes salen ya con él, sin tocar su `body` (RF-9).
- **`account_notices`** no guarda texto (la app lo compone a partir de `kind` y los nombres), así que no hay filas que reescribir.
- **Usuarios de prueba:** a partir de ahora `test-<uuid>@cafam.test`. El envío ya ignora cualquier dirección `.test` (migración `skip_test_addresses`), así que el dominio nuevo no se envía.

## Contratos e interfaces

- **Manifest** (`/manifest.webmanifest`): `name: "CaFam"`, `short_name: "CaFam"`; el resto igual.
- **Metadatos:** `title: { default: "CaFam", template: "%s · CaFam" }`; `appleWebApp.title` ya es "CaFam".
- **Petición `.ics`:** cabecera `user-agent: CaFam-import`.
- **Service worker:** `CACHE_NAME = "cafam-v3"`.
- **Funciones SQL:** las mismas firmas, el mismo `security definer`, el mismo `search_path = ''` y los mismos permisos que antes.
- **Guardia:** `npm test -- project-name` da verde si no hay ninguna coincidencia fuera de las excepciones. Si la hay, el mensaje lista cada `archivo:línea`.
- **Script de limpieza:** `node <scratchpad>/cleanup-old-test-users.mjs [--dry-run]`.
  - Lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY` de `.env.test.local` sin imprimirlos.
  - Se niega a seguir si la URL no contiene la referencia de dev `uthubyzhonrtrmbcqcjh`.
  - Imprime cuántos usuarios encuentra y cuántos borra.

## Flujo principal paso a paso

1. **Correo:** la migración nueva se aplica en dev (`npm run db:push`). Al borrar una cuenta con calendarios compartidos, `email_outbox` recibe el texto con CaFam (RF-8). El envío programado usa el remitente CaFam (RF-7, RF-9).
2. **Interfaz y PWA:** al cargar la app, la pestaña, el manifest, el logotipo, la barra lateral, la ayuda de iOS y `/privacy` dicen CaFam (RF-1 a RF-3, con "CF" intacto según RF-4). El navegador instala `sw.js` con `cafam-v3`, y su `activate` borra `calenderfam-v2` (RF-5). Una importación por enlace se presenta como `CaFam-import` (RF-6).
3. **Tests:** los usuarios de prueba nacen con `@cafam.test` (RF-15). El script borra de dev los antiguos (RF-16), y para prod el usuario lanza una consulta de solo lectura (RF-17).
4. **Documentación y guardia:** la guardia se escribe primero y falla con la lista de archivos de documentación pendientes. Después se renombran (RF-12, RF-13), y la guardia pasa a verde (RF-10, RF-14). La URL de Vercel no cambia (RF-11).
5. **Fuera del repositorio:**
   - El usuario fusiona en `main`, publica y aplica la migración en prod (RF-19).
   - Revisa las plantillas de Supabase Auth y el remitente de Brevo (RF-20).
   - Renombra el repositorio de GitHub, tras lo cual se actualiza el remoto y se comprueba Vercel (RF-18).
   - Por último, si quiere, renombra la carpeta local.

## Decisiones técnicas

- D1: **Migración nueva que redefine las dos funciones** con `create or replace`, copiando su última versión y cambiando solo el nombre. Descartado editar las migraciones aplicadas porque la constitución lo prohíbe y la base de datos no las volvería a ejecutar. Cubre: RF-7, RF-8, RF-19.
- D2: **Guardia con `git ls-files`** y las cadenas prohibidas montadas por trozos dentro del propio test, para que no se detecte a sí mismo. Excepciones:
  - las migraciones con versión anterior a `20261029130000`, que son las aplicadas;
  - la carpeta `specs/010-renombrar-cafam/`.

  Descartado recorrer el disco con `readdirSync`, como hace `no-secrets.test.ts`, porque incluiría archivos no versionados (`.next/`, `.env*`) y RF-10 habla de archivos versionados. Cubre: RF-10, RF-14.
- D3: **`CACHE_NAME` a `cafam-v3`.** El `activate` existente ya borra las cachés con otro nombre (spec 005, D18). Descartado `cafam-v2`, porque es mejor que la versión siga subiendo y nunca coincida con una anterior. Cubre: RF-5.
- D4: **Sustitución en las specs cerradas con un script de Python del scratchpad** (`encoding='utf-8', newline=''`, trampa de AGENTS.md). Reglas, en este orden:
  - `CalenderFam (CaFam)`, `"CalenderFam"/"CaFam"` y `CalenderFam/CaFam` → `CaFam`;
  - `calenderfam-v` → `cafam-v`;
  - `@calenderfam.test` → `@cafam.test`;
  - `CalendarioFamilia` y `CalenderFam` → `CaFam`.

  Después se revisa el diff con `git diff --word-diff` para confirmar que solo cambian nombres. Descartado un `sed` global, porque en Windows rompe los finales de línea y las tildes. Cubre: RF-12.
- D5: **Nombre técnico en minúsculas `cafam`** en `package.json`, `package-lock.json` y `config.toml`. `project_id` solo da nombre a los contenedores de un `supabase start` local, que no se usa, y no afecta al proyecto enlazado. Descartado `CaFam` con mayúsculas en `package.json`, porque npm exige minúsculas. Cubre: RF-10.
- D6: **La constitución deja de escribir los nombres antiguos** y remite a la spec 010 ("los nombres anteriores, listados en la spec 010"). Es un cambio de redacción que no cambia la regla. Descartado añadir la constitución a las excepciones de la guardia, porque RF-10 no la exceptúa. Cubre: RF-10.
- D7: **`AGENTS.md` se reescribe donde nombra el proyecto y se pone al día con la enmienda 3:**
  - título y §1 con el nombre único y el repositorio nuevo;
  - tabla de §2 con las specs 010 a 015 como "Aprobada, sin plan" (o el estado que tengan al cerrar);
  - resumen de §3 sin las prohibiciones de P9 que levantó la enmienda;
  - §6 con `cafam-v3`;
  - §11 sin el tema oscuro, los recurrentes ni las demás funciones que ya tienen spec;
  - §12 con la siguiente spec.

  Descartado limitarse a sustituir el nombre, porque RF-13 pide documentar la enmienda y las specs nuevas. Cubre: RF-13.
- D8: **Dominio de prueba `@cafam.test` y origen `https://cafam.test`.** `.test` está reservado (RFC 2606) y el envío ya lo ignora. Descartado `@example.com`, porque podría enviarse de verdad. Cubre: RF-15.
- D9: **Limpieza de dev con la API de administración** (`auth.admin.listUsers` paginado y `deleteUser` con los reintentos de `deleteTestUser`), y después borrado del correo en cola de `email_outbox` para `%@calenderfam.test`. Primero se ejecuta en `--dry-run` para ver el número; el usuario ya aprobó borrar. Descartado SQL directo sobre `auth.users`, porque saltarse la API de Auth puede dejar identidades y sesiones huérfanas. Cubre: RF-16, RF-17.
- D10: **Orden de los pasos externos:**
  1. fusionar y publicar;
  2. aplicar la migración en prod;
  3. revisar los paneles;
  4. renombrar el repositorio y actualizar el remoto (`git remote set-url origin https://github.com/alexp11mon/CaFam.git`);
  5. por último, la carpeta local.

  Descartado renombrar primero el repositorio, porque si Vercel perdiera la conexión no habría despliegue con el que comprobar el resto. Cubre: RF-18, RF-19, RF-20.
- D11: **RF-1 se comprueba en el navegador**, con el `<title>` de la portada y de Ajustes en `next start`. Descartado un test unitario de `layout.tsx`, porque importa `next/font`, que no carga en jsdom. El manifest y la barra lateral sí tienen test unitario. Cubre: RF-1.
- D12: **RF-7 se comprueba con un test unitario que lee la migración nueva**: `sender` con `'CaFam'` y ningún nombre antiguo. Descartado comprobarlo en `test:db`, porque `send_pending_emails` en `p_dry_run` no expone la petición a Brevo. RF-8 sí se comprueba en `test:db` leyendo el `body` de `email_outbox` tras borrar una cuenta. Cubre: RF-7, RF-8.

## Trazabilidad RF → módulo

| RF | Módulo | Comprobación |
|----|--------|--------------|
| RF-1 | brand-text | Navegador: `<title>` (D11) |
| RF-2 | brand-text | `manifest.test.ts` |
| RF-3 | brand-text | `side-rail.test.tsx`, navegador para el logotipo, iOS y `/privacy` |
| RF-4 | brand-text | `brand-icons.test.ts` sin cambios en el monograma |
| RF-5 | sw-cache | `brand-icons.test.ts` (`cafam-v3`) |
| RF-6 | ics-agent | `name-guard` y revisión del diff |
| RF-7 | mail-rename | Test unitario de la migración (D12) |
| RF-8 | mail-rename | `test:db`: `body` de `email_outbox` tras borrar una cuenta |
| RF-9 | mail-rename | Por diseño: el remitente se fija al enviar (modelo de datos) |
| RF-10 | name-guard, repo-config, docs-rename | `npm test -- project-name` |
| RF-11 | docs-rename | `invite-url.test.ts` sin cambios |
| RF-12 | docs-rename | `git diff --word-diff` de `specs/00*` (D4) |
| RF-13 | docs-rename | Revisión de `AGENTS.md` |
| RF-14 | name-guard | El test existe y falló antes de renombrar la documentación |
| RF-15 | test-data | `npm test` y `npm run test:db` en verde |
| RF-16 | dev-cleanup | Salida del script: 0 usuarios al repetirlo |
| RF-17 | dev-cleanup, prod-steps | Consulta de solo lectura en prod del usuario |
| RF-18 | prod-steps | `git remote -v` y despliegue de Vercel tras un push |
| RF-19 | mail-rename, prod-steps | `supabase db push` en prod sin errores |
| RF-20 | prod-steps | El usuario confirma los paneles de dev y prod |

## Riesgos y mitigaciones

- R1: **Copiar mal una función al redefinirla** y cambiar su comportamiento. Mitigación: copiar el cuerpo literal de la última versión y comparar con `diff`: solo cambian las líneas del nombre. Después, `npm run test:db -- account` en verde.
- R2: **Sustituir el nombre en specs cerradas cambia el significado de alguna evidencia**, por ejemplo "título CalenderFam" en la spec 001. Mitigación: es lo que pide la enmienda 3 (solo el nombre). La historia exacta sigue en git.
- R3: **La guardia detecta textos legítimos futuros**, como una spec que cite el nombre antiguo. Mitigación: las excepciones de D2 están en una lista explícita dentro del test, que solo crece con aprobación.
- R4: **Vercel se desconecta al renombrar el repositorio.** Mitigación: D10 lo deja para cuando ya está publicado. Si pasa, Vercel → Settings → Git → volver a conectar `alexp11mon/CaFam`.
- R5: **Renombrar la carpeta local cambia la ruta de la memoria de Claude Code** (`~/.claude/projects/C--Users-alexp-Desktop-projectsDev-CalendarioFamilia/`). Mitigación: el paso incluye copiar esa carpeta a la del nombre nuevo antes de abrir Claude Code en la nueva ruta.
- R6: **Límite de Supabase Auth al borrar unos 196 usuarios.** Mitigación: borrado secuencial con pausa y reintentos. Si salta el límite, se espera y se repite: el script es idempotente.
- R7: **`next dev` reescribe el bloque de `AGENTS.md`.** Mitigación: ese bloque no contiene el nombre, y solo se edita lo que hay debajo.

## Pasos fuera del repositorio (los ejecuta el usuario)

1. Fusionar y publicar (tras aprobar el cierre): `git switch main && git merge --ff-only 010-renombrar-cafam && git push origin main 010-renombrar-cafam`.
2. Migración en prod:
   ```
   npx supabase link --project-ref yznbdoskvtxeasujtirk
   npx supabase db push
   npx supabase link --project-ref uthubyzhonrtrmbcqcjh
   ```
3. Consulta de solo lectura en el SQL Editor de prod (RF-17): `select count(*) from auth.users where email like '%@calenderfam.test';`. Si no es 0, se informa y no se borra.
4. Paneles, en dev y en prod (RF-20):
   - Supabase → Authentication → Emails: asunto y texto de *Reset password*, *Change email address* y *Email address changed*.
   - Supabase → Authentication → SMTP Settings: *Sender name*.
   - Brevo → Remitentes: nombre del remitente.

   Donde ponga el nombre antiguo, cambiarlo por "CaFam".
5. Repositorio (RF-18):
   - `gh repo rename CaFam --repo alexp11mon/CalendarioFamilia`, o en GitHub → Settings → Repository name.
   - Actualizar el remoto: `git remote set-url origin https://github.com/alexp11mon/CaFam.git`.
   - Comprobar que Vercel sigue enlazado (Settings → Git) y que un push despliega.
6. Carpeta local (opcional, la última):
   - Cerrar Claude Code y `npm run dev`.
   - Renombrar `C:\Users\alexp\Desktop\projectsDev\CalendarioFamilia` a `CaFam`.
   - Copiar `~/.claude/projects/C--Users-alexp-Desktop-projectsDev-CalendarioFamilia` a `~/.claude/projects/C--Users-alexp-Desktop-projectsDev-CaFam`.

## Dudas abiertas

- Ninguna.
