# Plan 001 - Base de la aplicación

> Estado: **Borrador, pendiente de aprobación** (requiere spec aprobada).
> Spec de origen: `specs/001-base-aplicacion/spec.md`. Constitución: `docs/constitution.md`.

## Resumen de arquitectura

Monolito Next.js 16 (App Router) desplegado en Vercel Hobby: Server Components para leer datos, Server Actions para registro/login/logout y `src/proxy.ts` para refrescar la sesión y proteger rutas. Supabase Free aporta Auth (email/contraseña con sesión en cookies vía `@supabase/ssr`) y PostgreSQL, donde **RLS es la frontera de seguridad**: el código nunca decide permisos por sí solo, la base de datos los impone. La PWA es nativa (manifest generado por Next.js + service worker propio) y solo cachea recursos estáticos y la página offline.

```
Navegador / PWA instalada
  │  (cookies de sesión, HTTPS)
  ▼
Vercel ── src/proxy.ts ─────────── refresca sesión, redirige (RF-8, RF-9)
  │       Server Components ────── leen datos con la sesión del usuario (RF-13)
  │       Server Actions ───────── signUp / signIn / signOut (RF-1..RF-12)
  │       /api/cron/keep-alive ─── llamado 1 vez al día por Vercel Cron (RF-25)
  ▼
Supabase ── Auth (auth.users) ── trigger handle_new_user → profile + "Mi calendario" (RF-4)
          └ Postgres public.* con RLS + funciones de permiso (RF-15..RF-20)
```

## Módulos y responsabilidades

| Módulo | Ubicación | Qué hace | Qué no hace | Cubre |
|--------|-----------|----------|-------------|-------|
| `database` | `supabase/migrations/` | Tablas, enum, índices, restricciones, triggers y funciones de Postgres | No define políticas de acceso | RF-4, casos límite de datos |
| `access-policies` | `supabase/migrations/` | Políticas RLS y funciones `is_calendar_member` / `calendar_role_for` | No contiene lógica de interfaz | RF-15..RF-20 |
| `supabase-clients` | `src/lib/supabase/` (`server.ts`, `client.ts`, `proxy.ts`) | Crea clientes de Supabase (servidor con cookies, navegador, proxy) y expone tipos generados | No valida formularios ni decide redirecciones | RF-10 |
| `route-guard` | `src/proxy.ts`, `src/lib/auth/route-access.ts` | Decide, con una función pura, si una ruta exige sesión o debe redirigir; refresca la sesión | No consulta datos de negocio | RF-8, RF-9, RF-10 |
| `auth-validation` | `src/lib/auth/schemas.ts` | Esquemas `zod` de registro y login con normalización de email y mensajes en español | No llama a Supabase | RF-3, casos límite |
| `auth-errors` | `src/lib/auth/error-messages.ts` | Traduce códigos de error de Supabase Auth a mensajes en español | No muestra UI | RF-2, RF-6, RF-11, RF-12 |
| `auth` | `src/app/(auth)/login`, `src/app/(auth)/signup`, `src/app/(auth)/actions.ts`, `src/components/auth/` | Pantallas, formularios y Server Actions de registro, login y logout | No protege rutas | RF-1, RF-2, RF-5, RF-6, RF-7, RF-11, RF-12 |
| `dashboard` | `src/app/dashboard/`, `src/components/dashboard/` | Panel con nombre visible, lista de calendarios con color y rol, y botón de logout | No crea ni edita calendarios | RF-13, RF-14 |
| `ui-shell` | `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/ui/` | Layout raíz, `viewport`, portada pública, componentes base (botón, campo, alerta) responsive | No contiene lógica de negocio | RF-24, RNF-7 |
| `pwa` | `src/app/manifest.ts`, `public/sw.js`, `public/icons/`, `src/components/pwa/service-worker-register.tsx`, `src/app/offline/` | Manifest, iconos, metadatos Apple, registro del service worker y pantalla offline | No cachea páginas con sesión | RF-21, RF-22, RF-23 |
| `keep-alive` | `src/app/api/cron/keep-alive/route.ts`, `vercel.json` | Consulta mínima diaria a Supabase protegida por `CRON_SECRET` | No modifica datos | RF-25 |

## Modelo de datos

Todo en el esquema `public`, con RLS activado en todas las tablas (P3). Las fechas son `timestamptz` (UTC). Las claves primarias son `uuid` con `gen_random_uuid()`.

### Enum

- `calendar_role`: `'owner' | 'editor' | 'viewer'` (en la interfaz: Propietario, Editor, Lector).

### Tablas

**`profiles`** (1:1 con `auth.users`)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | uuid | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `display_name` | text | NOT NULL, `char_length(trim(display_name)) between 1 and 50` |
| `time_zone` | text | NOT NULL, DEFAULT `'Europe/Madrid'` |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL, DEFAULT `now()` |

El email no se duplica en `profiles`: vive solo en `auth.users` para no exponerlo a otros miembros.

**`calendars`**

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | uuid | PK |
| `owner_id` | uuid | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE |
| `name` | text | NOT NULL, `char_length(trim(name)) between 1 and 80` |
| `description` | text | NULL, `char_length(description) <= 500` |
| `color` | text | NOT NULL, DEFAULT `'#2563EB'`, `color ~ '^#[0-9A-Fa-f]{6}$'` |
| `created_at` / `updated_at` | timestamptz | NOT NULL, DEFAULT `now()` |

**`calendar_members`** (quién accede a qué calendario y con qué rol; el propietario también tiene fila con rol `owner` para que todas las políticas usen una sola fuente)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `calendar_id` | uuid | FK → `calendars(id)` ON DELETE CASCADE |
| `user_id` | uuid | FK → `profiles(id)` ON DELETE CASCADE |
| `role` | `calendar_role` | NOT NULL |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` |
| — | — | PK (`calendar_id`, `user_id`); índice en `user_id`; índice único parcial `(calendar_id) WHERE role = 'owner'` (un solo propietario) |

**`events`**

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| `id` | uuid | PK |
| `calendar_id` | uuid | NOT NULL, FK → `calendars(id)` ON DELETE CASCADE |
| `title` | text | NOT NULL, `char_length(trim(title)) between 1 and 200` |
| `description` | text | NULL, `char_length(description) <= 5000` |
| `location` | text | NULL, `char_length(location) <= 300` |
| `starts_at` | timestamptz | NOT NULL |
| `ends_at` | timestamptz | NOT NULL, CHECK `ends_at >= starts_at` |
| `all_day` | boolean | NOT NULL, DEFAULT `false` |
| `created_by` | uuid | NULL, FK → `profiles(id)` ON DELETE SET NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL, DEFAULT `now()` |
| — | — | índice (`calendar_id`, `starts_at`) |

Convención de eventos de día completo (la usará la spec 002): `all_day = true`, `starts_at` a las 00:00 del primer día y `ends_at` a las 00:00 del día siguiente al último (fin exclusivo), ambos en la zona horaria del perfil del creador.

### Funciones y triggers

- `set_updated_at()`: trigger BEFORE UPDATE en `profiles`, `calendars` y `events`.
- `handle_new_user()`: trigger AFTER INSERT en `auth.users`, `SECURITY DEFINER`, `search_path = ''`. Crea el perfil con `display_name` tomado de `raw_user_meta_data->>'display_name'` y el calendario "Mi calendario" (RF-4).
- `add_owner_membership()`: trigger AFTER INSERT en `calendars`, `SECURITY DEFINER`. Inserta la fila `(calendar_id, owner_id, 'owner')` en `calendar_members`.
- `is_calendar_member(p_calendar_id uuid) returns boolean` y `calendar_role_for(p_calendar_id uuid) returns calendar_role`: `SECURITY DEFINER`, `STABLE`, `search_path = ''`, basadas en `auth.uid()`. Evitan la recursión de políticas sobre `calendar_members`.

### Políticas RLS (rol `authenticated`; `anon` no tiene ninguna, por tanto no ve nada)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | `id = auth.uid()` | ninguna (lo hace el trigger) | `id = auth.uid()` | ninguna (cascada desde `auth.users`) |
| `calendars` | `is_calendar_member(id)` | `owner_id = auth.uid()` | `calendar_role_for(id) = 'owner'` | `calendar_role_for(id) = 'owner'` |
| `calendar_members` | `is_calendar_member(calendar_id)` | ninguna (RF-19; la spec 003 añadirá funciones controladas) | ninguna | ninguna |
| `events` | `is_calendar_member(calendar_id)` | `calendar_role_for(calendar_id) in ('owner','editor')` | ídem en USING y WITH CHECK | `calendar_role_for(calendar_id) in ('owner','editor')` |

En las políticas se usa `(select auth.uid())` para que Postgres lo evalúe una vez por consulta. `owner_id` de `calendars` no se puede cambiar por UPDATE (trigger que lo impide), así la transferencia de propiedad queda fuera de alcance.

### Persistencia y tipos

- Migraciones SQL versionadas en `supabase/migrations/` y aplicadas con `npx supabase db push`.
- Tipos TypeScript generados en `src/types/database.ts` con `npx supabase gen types typescript --linked`; no se editan a mano.

## Contratos e interfaces

### Rutas

| Ruta | Acceso | Contenido |
|------|--------|-----------|
| `/` | pública | Portada con botones "Crear cuenta" e "Iniciar sesión" (con sesión → `/dashboard`) |
| `/signup` | solo sin sesión (RF-9) | Formulario: nombre visible, email, contraseña |
| `/login` | solo sin sesión (RF-9) | Formulario: email, contraseña |
| `/dashboard` y subrutas | solo con sesión (RF-8) | Panel (RF-13, RF-14) |
| `/offline` | pública, precacheada | Pantalla "Sin conexión" con "Reintentar" (RF-23) |
| `/manifest.webmanifest` | pública | Generado por `src/app/manifest.ts` |
| `/sw.js` | pública | Service worker, cabecera `Cache-Control: no-cache` |
| `/api/cron/keep-alive` | `Authorization: Bearer ${CRON_SECRET}` | `200 {"ok":true}`; sin cabecera válida `401` |

### Server Actions (`src/app/(auth)/actions.ts`)

| Acción | Entrada (FormData) | Resultado |
|--------|--------------------|-----------|
| `signUp` | `displayName`, `email`, `password` | Éxito: `redirect('/dashboard')`. Error: `{ fieldErrors?: Record<campo, string>, formError?: string, values: { displayName, email } }` |
| `signIn` | `email`, `password` | Éxito: `redirect('/dashboard')`. Error: `{ formError: string, values: { email } }` |
| `signOut` | — | `redirect('/login')` |

Los formularios usan `useActionState` y deshabilitan el botón mientras la acción está pendiente (caso límite de doble clic).

### Validación (`auth-validation`)

- `email`: `trim().toLowerCase()`, formato email → "Introduce un email válido.".
- `password`: 8–72 caracteres → "La contraseña debe tener al menos 8 caracteres." / "La contraseña no puede superar los 72 caracteres.".
- `displayName`: `trim()`, 1–50 caracteres → "Introduce tu nombre." / "El nombre no puede superar los 50 caracteres.".

### Traducción de errores (`auth-errors`)

| Código Supabase Auth | Mensaje |
|----------------------|---------|
| `user_already_exists`, `email_exists` | "Ya existe una cuenta con este email." (RF-2) |
| `invalid_credentials` | "Email o contraseña incorrectos." (RF-6) |
| `weak_password` | "La contraseña debe tener al menos 8 caracteres." |
| `over_request_rate_limit`, `over_email_send_rate_limit` | "Demasiados intentos. Espera unos minutos y vuelve a probar." (RF-11) |
| error de red, 5xx o código desconocido | "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo." (RF-12) |

### Variables de entorno (`.env.example`)

| Variable | Dónde | Uso |
|----------|-------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente y servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cliente y servidor | Clave publicable (`sb_publishable_...`; la antigua `anon` también vale) |
| `CRON_SECRET` | solo servidor (Vercel) | Autentica el cron de keep-alive (P4) |
| `SUPABASE_SECRET_KEY` | solo `.env.test.local` local | Crear y borrar usuarios de prueba en `npm run test:db`. Nunca en Vercel ni en `src/` (P4) |

### Scripts de `package.json`

`dev`, `build`, `start`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `format` (`prettier --write .`), `format:check` (`prettier --check .`), `test` (`vitest run --project unit`), `test:db` (`vitest run --project db`), `db:push` (`supabase db push`), `db:types` (`supabase gen types typescript --linked > src/types/database.ts`).

### Configuración de Supabase Auth (panel)

- Proveedor Email activo; **"Confirm email" desactivado** (ver D6); longitud mínima de contraseña 8.
- Site URL y Redirect URLs: URL de Vercel y `http://localhost:3000`.

## Flujo principal paso a paso

1. **Registro (RF-1..RF-4):** el visitante abre `/signup` → `route-guard` confirma que no hay sesión (RF-9) → envía el formulario → `signUp` valida con `auth-validation` (RF-3) → `supabase.auth.signUp({ email, password, options: { data: { display_name } } })` → en Postgres, `handle_new_user` crea `profiles` y "Mi calendario", y `add_owner_membership` crea la membresía `owner` (RF-4) → como no hay confirmación de email, Supabase devuelve sesión y `@supabase/ssr` la guarda en cookies → `redirect('/dashboard')`. Si falla, `auth-errors` devuelve el mensaje (RF-2, RF-11, RF-12).
2. **Panel (RF-13, RF-14):** `src/proxy.ts` refresca la sesión con `supabase.auth.getClaims()` y deja pasar (RF-8, RF-10) → el Server Component consulta `calendar_members` con `calendars(name, color)` y el perfil propio; RLS solo devuelve filas permitidas (RF-15, RF-20) → renderiza la lista con el rol traducido.
3. **Logout (RF-7):** `signOut` → `supabase.auth.signOut({ scope: 'local' })` → cookies borradas → `redirect('/login')`.
4. **Login (RF-5, RF-6):** `/login` → `signIn` → `supabase.auth.signInWithPassword` → éxito: `/dashboard`; error: mensaje traducido.
5. **Protección (RF-8, RF-9):** en cada petición, `proxy.ts` obtiene la sesión y llama a `getRouteAccess(pathname, hasSession)` (función pura) → `allow` o `redirect(destino)`.
6. **PWA (RF-21..RF-23):** `layout.tsx` monta `ServiceWorkerRegister` (solo en producción) → `sw.js` precachea `/offline`, iconos y estáticos de `/_next/static/` → en navegaciones usa red primero y, si falla, devuelve `/offline`; nunca guarda en caché HTML ni respuestas de Supabase.
7. **Keep-alive (RF-25):** Vercel Cron llama a `/api/cron/keep-alive` a diario (06:00 UTC) con `CRON_SECRET` → la ruta hace `select id from calendars limit 1` con la clave publicable → la actividad diaria impide que Supabase Free pause el proyecto.

## Decisiones técnicas

- D1: Next.js 16 App Router con Server Actions para la autenticación. Descartado SPA (Vite + React) con llamadas directas a Supabase desde el cliente porque obliga a gestionar la sesión solo en el navegador y complica la protección de rutas. Motivo: stack confirmado y sesión en cookies httpOnly. Cubre: RF-1, RF-5, RF-7, RF-10.
- D2: Supabase Auth email/contraseña con `@supabase/ssr`. Descartado Auth.js/NextAuth porque añadiría una segunda capa de usuarios fuera de Postgres y RLS dejaría de conocer al usuario. Motivo: `auth.uid()` disponible en las políticas. Cubre: RF-1, RF-5, RF-10, RF-15.
- D3: `src/proxy.ts` (nombre que sustituye a `middleware.ts` en Next.js 16) con la decisión extraída a una función pura `getRouteAccess`. Descartado comprobar la sesión en cada `page.tsx` porque es fácil olvidarlo en una página nueva. Motivo: un único punto de control y testeable con Vitest. Cubre: RF-8, RF-9.
- D4: RLS en todas las tablas con funciones `SECURITY DEFINER` (`is_calendar_member`, `calendar_role_for`) y el propietario como fila `owner` en `calendar_members`. Descartado comprobar permisos solo en el código de Next.js porque una consulta olvidada expondría datos. Motivo: P3, la base de datos es la última barrera. Cubre: RF-15..RF-20.
- D5: Calendario inicial y membresía creados por triggers de Postgres. Descartado crearlos desde la Server Action porque, si la acción fallase tras crear el usuario, quedaría una cuenta sin calendario. Motivo: atomicidad en la misma transacción. Cubre: RF-4.
- D6: "Confirm email" desactivado en Supabase. Descartado activarlo porque el SMTP por defecto de Supabase Free solo envía a miembros del equipo del proyecto y con un límite muy bajo por hora, de modo que los familiares no recibirían el correo; configurar un SMTP gratuito externo queda para la spec 005. Motivo: P2 y simplicidad. Cubre: RF-1.
- D7: PWA nativa (`app/manifest.ts` + `public/sw.js` propio, unas 60 líneas). Descartados `next-pwa` (sin mantenimiento e incompatible con Turbopack/App Router actual) y Serwist (dependencia extra con configuración específica de bundler). Motivo: cero dependencias (P6) y control total de qué se cachea. Cubre: RF-21..RF-23.
- D8: Vitest con dos proyectos: `unit` (jsdom: esquemas, errores, `getRouteAccess`, componentes) y `db` (node: integración contra el proyecto Supabase `dev` con usuarios de prueba creados con `SUPABASE_SECRET_KEY`). Descartado `supabase start` local porque exige Docker, que no está instalado en el equipo de desarrollo, y pgTAP por la misma razón. Motivo: probar RLS de verdad sin Docker. Cubre: RF-2, RF-4, RF-15..RF-20.
- D9: Dos proyectos Supabase Free: `calendario-dev` (desarrollo y tests) y `calendario-prod` (Vercel), ambos en región UE (Frankfurt o París). Descartado un solo proyecto porque los tests de `test:db` crearían y borrarían usuarios en producción. Motivo: aislamiento sin coste (el plan Free permite 2 proyectos activos). Cubre: RF-15..RF-20, RF-25.
- D10: Keep-alive con Vercel Cron diario. Descartado GitHub Actions programado porque añade otro servicio y otro secreto que mantener. Motivo: Vercel Hobby incluye cron diario y Supabase Free pausa proyectos tras 7 días sin actividad. Cubre: RF-25.
- D11: `zod` para validar formularios en servidor (y reutilizable en cliente). Descartada validación manual porque se repetirá en las specs 002 y 003 (eventos, PIN). Motivo: un único esquema tipado por formulario. Cubre: RF-3.
- D12: Rutas en inglés (`/signup`, `/login`). Descartado `/registro` porque rompe la regla de nombres de carpetas en inglés de la constitución. Motivo: coherencia carpeta = URL. Cubre: RF-1, RF-5.

## Trazabilidad RF -> módulo

| RF | Módulos |
|----|---------|
| RF-1 | auth, auth-validation, database |
| RF-2 | auth, auth-errors |
| RF-3 | auth-validation, auth |
| RF-4 | database |
| RF-5 | auth |
| RF-6 | auth, auth-errors |
| RF-7 | auth, dashboard |
| RF-8 | route-guard |
| RF-9 | route-guard |
| RF-10 | supabase-clients, route-guard |
| RF-11 | auth-errors, auth |
| RF-12 | auth-errors, auth |
| RF-13 | dashboard |
| RF-14 | dashboard, ui-shell |
| RF-15 | access-policies |
| RF-16 | access-policies |
| RF-17 | access-policies, database |
| RF-18 | access-policies, database |
| RF-19 | access-policies |
| RF-20 | access-policies |
| RF-21 | pwa |
| RF-22 | pwa |
| RF-23 | pwa |
| RF-24 | ui-shell |
| RF-25 | keep-alive |

## Riesgos y mitigaciones

- R1: Supabase Free pausa el proyecto tras 7 días sin actividad → keep-alive diario (D10); si aun así se pausa, se reactiva desde el panel sin pérdida de datos.
- R2: Recursión infinita en políticas de `calendar_members` → funciones `SECURITY DEFINER` (D4) y test específico en `test:db`.
- R3: Una función `SECURITY DEFINER` mal escrita expone datos → todas con `search_path = ''`, nombres totalmente cualificados, solo leen filas del `auth.uid()` actual, y `revoke execute ... from anon`.
- R4: Filtrar `SUPABASE_SECRET_KEY` → solo en `.env.test.local` (ignorado por git), nunca en Vercel; test que falla si algún archivo de `src/` la referencia (P4).
- R5: El service worker sirve una versión antigua tras un despliegue → `sw.js` con `Cache-Control: no-cache`, nombre de caché versionado y limpieza de cachés antiguas en `activate`.
- R6: Datos de un usuario visibles offline para otro usuario del mismo dispositivo → el service worker no cachea HTML ni respuestas de API (caso límite de la spec).
- R7: iOS no muestra aviso de instalación → texto de ayuda en la portada solo en Safari iOS ("Compartir > Añadir a pantalla de inicio"); metadatos `apple-touch-icon` y `appleWebApp` en `layout.tsx`.
- R8: Sin recuperación de contraseña en esta spec → el administrador restablece contraseñas desde el panel de Supabase hasta la spec 005.
- R9: Registro abierto expuesto a bots → los límites de tasa de Supabase Auth (RF-11); si hay abuso, se añade CAPTCHA o lista de emails permitidos en una spec posterior.
- R10: `create-next-app` se niega a ejecutarse en una carpeta con archivos existentes (`specs/`, `package.json`...) → se genera en una carpeta temporal y se mueve (ver Anexo B).
- R11: Los tests `test:db` dependen de red y del proyecto `dev` → se ejecutan aparte de `npm test` y solo son obligatorios en tareas que tocan datos (constitución).

## Dudas abiertas

- Ninguna técnica. Las dudas de producto (registro abierto, nombre/color de la app, zona horaria) están en la spec con su recomendación aplicada por defecto; si cambian, solo afectan a textos, `manifest.ts` y al valor por defecto de `time_zone`.

---

## Anexo A — Evolución prevista del modelo de datos (informativo, NO se implementa en esta spec)

Se documenta para que el esquema de la spec 001 no bloquee lo que viene. Cada tabla se diseñará y aprobará en su spec.

- **Spec 003, `calendar_invites`** (enlace de invitación único): `id`, `calendar_id`, `token_hash` (SHA-256 del token; el token en claro solo aparece en el enlace `/invite/<token>`), `role` (`editor` | `viewer`), `created_by`, `expires_at`, `max_uses`, `use_count`, `revoked_at`, `created_at`. Se acepta mediante una función RPC `accept_invite(token)` `SECURITY DEFINER` que inserta en `calendar_members`.
- **Spec 003, `calendar_access_codes`** (ID de calendario + PIN): `calendar_id` (PK), `public_code` (8 caracteres sin ambiguos, único), `pin_hash` (bcrypt con `pgcrypto`), `role`, `enabled`, `updated_at`. RPC `join_calendar_with_code(code, pin)` con límite de intentos fallidos (tabla `join_attempts`: máximo 5 fallos en 15 minutos por usuario) para impedir fuerza bruta del PIN.
- **Spec 003, políticas adicionales en `calendar_members`**: el propietario cambia roles y expulsa; cualquier miembro no propietario puede abandonar el calendario. Política SELECT ampliada de `profiles` para ver el nombre de quienes comparten calendario contigo.
- **Spec 004, `ics_subscriptions`**: `id`, `owner_id`, `name`, `color`, `url` (secreta, visible solo para su propietario), `last_fetched_at`, `last_error`, `created_at`. Los eventos externos se descargan en servidor con caché, nunca se escriben en `events`; protección SSRF (solo `https`/`webcal`, sin IPs privadas). Librería de parseo .ics y expansión de recurrencias se aprueba en esa spec.
- **Spec 002**: recurrencia de eventos (columna `recurrence_rule` RRULE) y librería de vistas de calendario se deciden allí.
- **Spec 006, `external_accounts`**: tokens OAuth cifrados con Supabase Vault. Riesgo conocido: Google exige verificación de la app para scopes de Calendar; en modo "testing" los refresh tokens caducan a los 7 días.

## Anexo B — Comandos de arranque (se ejecutan en T1–T3, tras aprobar spec, plan y tareas)

Ejecutar en Git Bash desde la raíz del proyecto.

```bash
# 1. Repositorio git
git init -b main

# 2. Generar Next.js 16 en una carpeta temporal (la raíz ya tiene archivos)
rm -f package.json package-lock.json   # solo contienen next/react sin instalar; los regenera create-next-app
npx create-next-app@latest next-tmp --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --disable-git --yes
cp -rn next-tmp/. .                    # -n: no sobrescribe README.md ni .gitignore existentes
cat next-tmp/.gitignore >> .gitignore  # fusionar reglas de Next (.next/, .vercel, next-env.d.ts...)
rm -rf next-tmp
npm install

# 3. Dependencias aprobadas en la constitución
npm install @supabase/supabase-js @supabase/ssr zod
npm install -D prettier eslint-config-prettier vitest @vitejs/plugin-react vite-tsconfig-paths jsdom \
  @testing-library/react @testing-library/dom @testing-library/user-event @testing-library/jest-dom supabase

# 4. Supabase CLI (requiere haber creado los proyectos en supabase.com)
npx supabase login
npx supabase init
npx supabase link --project-ref <ref-de-calendario-dev>

# 5. Variables de entorno
cp .env.example .env.local             # y rellenar valores

# 6. Comprobación
npm run dev
```

Tras el paso 2 hay que revisar que `.gitignore` incluya `.env*.local` y `.env.test.local`, y añadir `.vercel/` si no está.
