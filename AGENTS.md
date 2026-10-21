<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CalendarioFamilia (CalenderFam) — guía para agentes

Contexto completo del proyecto para cualquier IA que empiece a trabajar en él. Léelo entero antes de tocar código. El bloque de arriba lo gestiona `next dev`: no lo edites; todo lo de debajo es documentación del proyecto y `next dev` lo respeta.

> Última actualización: 2026-10-22, al cerrar la spec 003.

## 1. Qué es

**CalenderFam** (nombre corto **CaFam**) es una PWA de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso **estrictamente personal** entre familia y amigos. Cada usuario se registra, ve sus calendarios en un panel, crea eventos, los comparte con roles Lector/Editor (por enlace o por ID y PIN) y (en specs futuras) se suscribe a calendarios externos `.ics`.

- Sin ánimo de lucro, sin publicidad ni analítica, y **coste cero**: solo capas gratuitas (Supabase Free, Vercel Hobby, GitHub Free).
- Producción: <https://calendario-familia-five.vercel.app>
- Repositorio (privado): <https://github.com/alexp11mon/CalendarioFamilia>
- Idioma: **español** en todo lo visible para el usuario, docs, specs y mensajes de commit; **inglés** en identificadores, nombres de archivos y comentarios técnicos.

## 2. Estado actual

| Spec | Alcance | Estado |
|------|---------|--------|
| 001-base-aplicacion | Proyecto base, auth email/contraseña, esquema con RLS, panel esqueleto, PWA, despliegue | **Cerrada** (2026-10-21), T1–T12 hechas |
| 002-calendarios-y-eventos | CRUD de calendarios, categorías y eventos; vistas mensual, semanal y diaria; filtros por persona con orden guardado; juntar calendarios | **Cerrada** (2026-10-21), T1–T12 hechas |
| 003-comparticion | Enlace de invitación, ID de calendario + PIN, roles Lector/Editor, lista de miembros, aviso al juntar | **Cerrada** (2026-10-22), T1–T12 hechas |
| 004-importacion-ics | Importación única de un `.ics` (enlace o archivo) a un calendario propio editable y compartible | Spec aprobada (2026-10-22); plan en curso |
| 005-gestion-de-cuenta | Recuperar contraseña, cambiar email, borrar cuenta, editar perfil (requiere SMTP gratuito) | Pendiente |
| 006-sincronizacion-oauth | Sincronización bidireccional por OAuth 2.0 (futura) | Pendiente |

Lo que hay hoy: registro, login, logout, protección de rutas, portada, pantalla offline, PWA instalable y cron de keep-alive (spec 001), y además (spec 002):

- Panel con los calendarios en el orden guardado por el usuario, con accesos a crear, editar, categorías y juntar.
- CRUD de calendarios (nombre, descripción, color de una paleta pastel cerrada) y de categorías por calendario.
- CRUD de eventos (hora, día completo, varios días, descripción, lugar, color propio y categoría).
- Vistas mensual, semanal y diaria que mezclan todos los calendarios, con panel de filtros por persona → calendario → categoría. La visibilidad y el orden se guardan por usuario.
- Juntar calendarios propios en uno (fusión real, irreversible, con confirmación).

Añadido por la spec 003:

- Compartir por **enlace** (`/dashboard/calendars/[id]/share`): rol Lector o Editor, 1 a 20 usos, caduca a los 7 días, se muestra una sola vez y se puede revocar. La ruta pública `/invite/[token]` enseña una vista previa y solo se une al pulsar "Unirme".
- Compartir por **ID y PIN**: ID de 8 caracteres y PIN de 6 a 10 dígitos que elige el propietario (nadie puede volver a verlo), con límite de 5 fallos por persona y 20 por ID cada 15 minutos. Se usa en `/dashboard/join`.
- Lista de miembros (`/members`, solo nombre y rol, nunca email): el propietario cambia roles y expulsa; los demás pueden salir. El propietario no puede salir ni ser expulsado.
- Al juntar calendarios, la confirmación nombra a quien pierde el acceso y a quien pasa a ver eventos de otros calendarios.

**No hay** `.ics` (004), gestión de cuenta (005) ni eventos recurrentes (spec futura sin número).

## 3. Reglas de trabajo (obligatorias)

La fuente de verdad es [`docs/constitution.md`](docs/constitution.md). Resumen de lo que más afecta a un agente:

- **Flujo SDD (P7):** no se escribe código sin `spec.md` → `plan.md` → `tasks.md` aprobados explícitamente por el usuario, en ese orden. Cada spec vive en `specs/NNN-nombre/`. Se implementa **una tarea `Tn` cada vez y con el test primero** (rojo → verde). Cada commit cita su tarea.
  - Hay skills para redactarlos: `spec-generator`, `plan-generator`, `tasks-generator` y `constitution-generator`.
- **Verificación obligatoria (P8):** ninguna tarea se da por hecha sin ejecutar y **reportar la salida** de:
  ```
  npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
  npm run test:db   # obligatorio si la tarea toca esquema, RLS o acceso a datos
  ```
  más una prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Al cerrar una tarea se marca `[x]` en `tasks.md`.
- **Privado por defecto (P3):** toda tabla de `public` tiene RLS. La base de datos es la frontera de seguridad; el código nunca decide permisos por sí solo.
- **Secretos solo en el servidor (P4):** `SUPABASE_SECRET_KEY` y `CRON_SECRET` nunca llevan prefijo `NEXT_PUBLIC_`, nunca se importan en `src/` ni se suben a git. `tests/unit/no-secrets.test.ts` falla si `src/` menciona `SUPABASE_SECRET_KEY` o `service_role`.
- **Stack cerrado (P6):** solo las dependencias de la sección 4. Cualquier otra exige aprobación del usuario registrada en la spec que la introduce (incluidas la librería de vistas de calendario de la 002 y la de parseo `.ics` de la 004).
- **Prohibido:** servicios de pago, SDK de analítica/tracking/telemetría (GA, Sentry…), librerías PWA (`next-pwa`, Serwist, Workbox), ORMs (Prisma, Drizzle), backends paralelos, y otro gestor de paquetes que no sea npm.
- **Aprobaciones del usuario:** pasar de fase (spec → plan → tareas → implementación) y cerrar una spec exigen su aprobación explícita. No la des por supuesta.
- **Acciones externas:** el usuario ejecuta él mismo (con `!` en Claude Code) las acciones sobre producción: `supabase db push` a prod, `git push` y merges a `main`. Prepárale los comandos exactos.

## 4. Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript 5 `strict`, sin `any` explícito (ESLint en error); Node.js 24 |
| Framework | **Next.js 16.4** (App Router, Turbopack, Server Components, Server Actions), React 19.3 |
| Estilos | Tailwind CSS 4 vía `@tailwindcss/postcss` (`postcss.config.mjs`) |
| Datos y auth | Supabase Free: PostgreSQL 17 con RLS + Supabase Auth (email/contraseña) con `@supabase/ssr` (sesión en cookies) |
| Validación | `zod` 4 |
| Hosting | Vercel Hobby (incluye el cron diario), repo en GitHub |
| PWA | `src/app/manifest.ts` nativo + service worker propio en `public/sw.js` |
| Tests | Vitest 5 (proyectos `unit` con jsdom y `db` con node), Testing Library |
| Calidad | ESLint 9 (`eslint-config-next` + `eslint-config-prettier`), Prettier 3 |
| BD | Supabase CLI (`supabase` como devDependency) para migraciones y tipos |

Dependencias de producción: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`. El `package.json` no debe crecer sin aprobación.

## 5. Estructura del repositorio

```
.
├── AGENTS.md                  # este archivo (CLAUDE.md lo importa)
├── docs/constitution.md       # principios, stack permitido/prohibido, convenciones, verificación
├── specs/NNN-nombre/          # spec.md, plan.md, tasks.md de cada spec (con trazabilidad RF → tareas → evidencia)
├── src/
│   ├── proxy.ts               # "middleware" de Next 16: refresca sesión y aplica getRouteAccess
│   ├── app/
│   │   ├── layout.tsx         # <html lang="es">, metadata (título, appleWebApp), viewport, ServiceWorkerRegister
│   │   ├── globals.css        # @import "tailwindcss" + tokens @theme de marca
│   │   ├── page.tsx           # portada pública "/" (con sesión redirige a /dashboard) + ayuda de instalación iOS
│   │   ├── manifest.ts        # /manifest.webmanifest
│   │   ├── icon.png           # favicon de marca
│   │   ├── (auth)/            # grupo sin segmento de URL
│   │   │   ├── actions.ts     # Server Actions signUp, signIn, signOut
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── dashboard/         # panel (page.tsx) y todo lo de la spec 002, protegido por getRouteAccess
│   │   │   ├── calendar/      # vistas mes/semana/día (?view=&date=) + preferences-actions.ts
│   │   │   ├── calendars/     # new, [id]/edit, [id]/categories, merge + actions.ts (calendarios y juntar)
│   │   │   └── events/        # new, [id] (detalle + edición + borrado) + actions.ts
│   │   ├── dashboard/join/    # "Unirme con código" (ID y PIN) + actions.ts
│   │   ├── dashboard/calendars/[id]/share/    # invitaciones y ID/PIN (solo propietario) + actions.ts
│   │   ├── dashboard/calendars/[id]/members/  # lista de miembros (cualquier miembro) + actions.ts
│   │   ├── invite/[token]/    # vista previa y "Unirme" (ruta pública a nivel de proxy) + actions.ts
│   │   ├── offline/page.tsx   # "Sin conexión" + "Reintentar" (estática, la precachea el SW)
│   │   └── api/cron/keep-alive/route.ts  # GET protegido por CRON_SECRET
│   ├── components/
│   │   ├── ui/                # button (variantes), link-button, text-field, text-area, select, form-alert (solo tokens de marca)
│   │   ├── auth/              # auth-card, login-form, signup-form (Client Components con useActionState)
│   │   ├── dashboard/         # calendar-list
│   │   ├── calendar/          # formularios, vistas (month/week/day, time-grid), filtros, workspace, merge-form, confirm-dialog…
│   │   ├── sharing/           # invite-form, copy-button, invite-list, access-code-panel, member-list, join-code-form, invite-join-card
│   │   └── pwa/               # service-worker-register, retry-button, ios-install-hint
│   ├── lib/
│   │   ├── auth/              # schemas.ts (zod), error-messages.ts, form-state.ts, route-access.ts, next-path.ts (destino tras login: solo /invite/<token>)
│   │   ├── calendar/          # LÓGICA PURA testeada: palette, time-zone, ranges, layout, grouping, format, schemas, error-messages; queries.ts (lecturas con RLS)
│   │   ├── sharing/           # schemas, error-messages, merge-access, invite-url, roles (puros) y queries.ts (lecturas con RLS)
│   │   ├── forms/             # form-state.ts: FormState genérico, ConfirmState, ParseResult, readString
│   │   └── supabase/          # env.ts, server.ts, client.ts, proxy.ts
│   └── types/database.ts      # GENERADO con `npm run db:types`; no editar a mano
├── public/
│   ├── sw.js                  # service worker propio
│   └── icons/                 # icon-192, icon-512, icon-512-maskable, apple-touch-icon
├── supabase/
│   ├── config.toml
│   └── migrations/            # 001: base_schema, rls_policies · 002: calendars_and_events, merge_calendars · 003: sharing_tables_and_policies, members_with_names, invite_functions, access_code_functions, fix_join_with_code
├── tests/
│   ├── setup-unit.ts
│   ├── unit/                  # *.test.ts(x): lógica pura, formularios, vistas, filtros, sw-no-data, no-secrets…
│   └── integration/           # schema, rls, signup, login, calendars-events, merge-calendars, preferences, range-performance contra Supabase dev + helpers.ts
├── vercel.json                # cron "0 6 * * *" → /api/cron/keep-alive
├── next.config.ts             # cacheComponents, partialPrefetching, cabeceras de /sw.js
├── postcss.config.mjs, eslint.config.mjs, vitest.config.ts, tsconfig.json (alias @/* → src/*)
└── .env.example               # variables documentadas sin valores
```

Nombres de archivos en kebab-case (`login-form.tsx` exporta `LoginForm`), salvo los reservados de Next (`page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`, `(grupo)`). Rutas URL en inglés.

## 6. Arquitectura

Monolito Next.js desplegado en Vercel. Server Components leen datos con la sesión del usuario, Server Actions hacen registro/login/logout y `src/proxy.ts` refresca la sesión y protege rutas. Supabase aporta Auth y Postgres, donde **RLS impone los permisos**.

```
Navegador / PWA ──cookies──▶ Vercel ─ src/proxy.ts ── refresca sesión (getClaims) + getRouteAccess()
                                    ├ Server Components ── leen con la sesión del usuario
                                    ├ Server Actions ───── signUp / signIn / signOut
                                    └ /api/cron/keep-alive ◀── Vercel Cron 06:00 UTC
                                          ▼
                             Supabase ─ Auth (auth.users) ─ trigger handle_new_user
                                      └ Postgres public.* con RLS + funciones de permiso
```

### Rutas

| Ruta | Acceso | Contenido |
|------|--------|-----------|
| `/` | pública | Portada; con sesión redirige a `/dashboard` (lo hace la página, no el proxy) |
| `/signup`, `/login` | solo sin sesión (con sesión → `/dashboard`) | Formularios; aceptan `?next=`, que solo se sigue si es `/invite/<token>` (campo oculto leído en el cliente) |
| `/dashboard` y subrutas | solo con sesión (sin sesión → `/login`) | Panel |
| `/dashboard/calendar` | con sesión | Vistas `?view=month\|week\|day&date=YYYY-MM-DD` (valores inválidos → mes de hoy) |
| `/dashboard/calendars/new`, `/[id]/edit`, `/[id]/categories`, `/merge` | con sesión | Calendarios, categorías y juntar. `edit` solo propietario, `categories` propietario o editor; otros → 404 |
| `/dashboard/events/new`, `/dashboard/events/[id]` | con sesión | Alta (`?calendar=&date=`) y detalle con edición y borrado |
| `/dashboard/calendars/[id]/share` | solo propietario (otros → 404) | Invitaciones por enlace e ID y PIN |
| `/dashboard/calendars/[id]/members` | cualquier miembro (ajeno → 404) | Lista de miembros; controles según el rol |
| `/dashboard/join` | con sesión | Unirme con ID y PIN |
| `/invite/[token]` | sin sesión → `/login?next=/invite/<token>`; con sesión, vista previa | Cabeceras `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` |
| `/offline` | pública | Pantalla sin conexión |
| `/manifest.webmanifest`, `/sw.js`, `/icons/*` | pública | PWA |
| `/api/cron/keep-alive` | `Authorization: Bearer ${CRON_SECRET}` | `200 {"ok":true}` / `401` / `500` |

La decisión de acceso es una función pura, `getRouteAccess(pathname, hasSession)`, en `src/lib/auth/route-access.ts` (testeada en `route-access.test.ts`). Para proteger una ruta nueva se cambia **ahí**, no en cada página. El `matcher` de `src/proxy.ts` excluye estáticos, `sw.js` y el manifest.

### Autenticación

- `signUp` valida con `signUpSchema` (email normalizado a minúsculas sin espacios; contraseña de 8 a 72 caracteres; nombre de 1 a 50) y llama a `supabase.auth.signUp` con los metadatos `display_name` y `time_zone`. La zona horaria la detecta el navegador (`Intl`) en un campo oculto; si no es válida se descarta y Postgres aplica `Europe/Madrid`.
- **"Confirm email" está desactivado** en Supabase (no hay SMTP hasta la spec 005), así que el registro devuelve sesión y redirige a `/dashboard`. El registro es abierto (cualquiera con la URL).
- Los errores de Supabase se traducen en `src/lib/auth/error-messages.ts`; un código desconocido o un error de red se convierte en "No se ha podido conectar…".
- Los formularios usan `useActionState`, `noValidate` (los errores vienen del servidor en español) y desactivan el botón mientras la acción está pendiente.
- `signOut` usa `scope: "local"` y redirige a `/login`.

### Base de datos (`supabase/migrations/`)

- Enum `calendar_role`: `owner | editor | viewer` (en la UI: Propietario, Editor, Lector).
- Tablas: `profiles` (1:1 con `auth.users`: `display_name`, `time_zone`), `calendars` (`owner_id`, `name`, `description`, `color`, por defecto `#2563EB`), `calendar_members` (PK `calendar_id + user_id`, `role`; **el propietario también tiene su fila `owner`**, con un solo owner por calendario) y `events` (`starts_at`/`ends_at` en `timestamptz` con `ends_at >= starts_at`, `all_day`, `created_by`). Todas tienen `created_at` y, las editables, `updated_at`.
- Triggers:
  - `handle_new_user`: crea el perfil y "Mi calendario".
  - `add_owner_membership`: crea la fila `owner`.
  - `validate_time_zone`: en INSERT aplica el respaldo `Europe/Madrid`; en UPDATE rechaza valores no válidos.
  - `prevent_owner_change` y `set_updated_at`.
- Permisos: `is_calendar_member(id)` y `calendar_role_for(id)` son `SECURITY DEFINER` con `search_path = ''` y evitan la recursión de políticas. `list_tables_without_rls()` la usa el test que garantiza P3.
- Políticas:

  | Tabla | Leer | Escribir |
  |-------|------|----------|
  | `profiles` | Solo el propio | Actualizar solo el propio |
  | `calendars` | Los miembros | Crear el usuario como owner; modificar y borrar solo el owner |
  | `calendar_members` | Los miembros | Nadie inserta ni modifica: la spec 003 añadirá RPC controladas |
  | `events` | Los miembros | Crear, modificar y borrar owner y editor |

  `anon` no ve nada.
- Convención de eventos de día completo: `all_day = true`, inicio a las 00:00 **UTC** del primer día y fin exclusivo a las 00:00 UTC del día siguiente al último. Se muestran por fecha UTC sin convertir a la zona del lector (un cumpleaños no cambia de día entre zonas, plan 002 D6). Los eventos con hora son instantes UTC que se escriben y muestran en la zona del **perfil**, que el servidor lee de la base de datos (nunca del cliente).
- Añadido por la spec 002:
  - `event_categories (calendar_id, name)`: por calendario, nombre único ignorando mayúsculas y espacios; leen los miembros, escriben propietario y editor.
  - `events.color` (opcional) y `events.category_id`. La FK compuesta `(category_id, calendar_id)` impide una categoría de otro calendario; al borrar la categoría el evento queda sin ella; un trigger la quita al mover el evento a otro calendario.
  - `calendar_preferences (user_id, calendar_id, visible, position)` y `person_preferences (user_id, person_id, position)`: privadas, filas creadas bajo demanda (sin fila = visible y al final). Los upserts parciales conservan la otra columna.
  - `visible_people()` (`SECURITY DEFINER`): `id` y `display_name` del usuario y de los propietarios de calendarios que comparte, sin zona horaria. La política de `profiles` sigue siendo "solo el propio".
  - `merge_calendars(p_source_ids, p_target_id, p_name, p_color)` (`SECURITY INVOKER`, una transacción): solo propietario de todos; unifica categorías con el mismo nombre; los miembros de los calendarios que desaparecen se pierden (ver Dudas de la spec 003).
  - Límites: calendario 50, categoría 40, título 100, descripción de evento 2000, lugar 200. La paleta de colores NO se impone en SQL, solo en `zod` (`lib/calendar/palette.ts`).
- Añadido por la spec 003:
  - `calendar_invites` (solo guarda `token_hash` = SHA-256 del token de 43 caracteres), `calendar_access_codes` (`public_code` de 8 caracteres de un alfabeto de 31 sin `I L O 0 1`; `pin_hash` con bcrypt de `pgcrypto`) y `join_attempts` (solo fallos). Los hashes se ocultan con **permiso por columna**: pedir `*` o `token_hash`/`pin_hash` da `42501`. Nadie escribe en estas tablas directamente.
  - `calendar_members`: `UPDATE` solo de la columna `role` y solo del propietario sobre filas no `owner`; `DELETE` por el propietario sobre otros o por cualquiera sobre su propia fila si no es `owner`. El `INSERT` directo sigue prohibido. Un trigger borra las preferencias de quien sale (los eventos y categorías que creó se quedan).
  - Funciones `SECURITY DEFINER` con `search_path = ''`: `create_invite`, `revoke_invite`, `get_invite_preview`, `accept_invite` (bloquea la fila: la carrera por el último uso da un éxito y un `CF404`), `set_access_code`, `disable_access_code`, `join_with_code` (devuelve `status` `ok | member | invalid | limited` en vez de lanzar, para que el fallo quede registrado) y `calendar_members_with_names(uuid[])` (única vía para ver nombres ajenos: nombre y rol, sin email ni zona horaria). `CF404` es el SQLSTATE propio de "invitación no válida".
  - `merge_calendars` no cambia: los miembros de los calendarios que desaparecen caen en cascada.
- **Cambios de esquema solo mediante una migración nueva** en `supabase/migrations/` (nunca editando el panel ni migraciones ya aplicadas). Después: `npm run db:push` (dev), `npm run db:types` y tests en `tests/integration/`.
- La evolución prevista (`calendar_invites`, `calendar_access_codes`, …) está en el Anexo A de `specs/001-base-aplicacion/plan.md`.

### PWA

- Manifest: CalenderFam/CaFam, `theme_color #2563EB`, `start_url /dashboard`, `standalone`, iconos 192, 512 y 512 maskable.
- iOS: `appleWebApp` en `layout.tsx` + `apple-touch-icon`. La portada muestra la ayuda "Compartir › Añadir a pantalla de inicio" **solo** en Safari iOS.
- `public/sw.js`:
  - Precachea `/offline`, los iconos y los `/_next/static/` que referencia `/offline`.
  - En navegaciones usa red primero, con `/offline` como respaldo.
  - Usa caché primero para `/_next/static/` e `/icons/`.
  - **Nunca cachea HTML con sesión ni respuestas de Supabase** (privacidad en dispositivos compartidos).
  - **Si cambias `sw.js`, sube `CACHE_NAME`** (`calenderfam-vN`).
  - Se registra solo en producción.

### Identidad visual

Tokens en `src/app/globals.css` (`@theme`): `brand` `#2563EB` (botones y enlaces, texto blanco 5,2:1), `brand-soft` `#A6E1FA` (**solo fondo**, nunca texto sobre blanco) e `ink` `#0D160B` (texto). Usa `bg-brand`, `text-ink`… y no valores arbitrarios como `bg-[#2563EB]`. Contraste mínimo 4,5:1 (WCAG AA). Fondo blanco, sin tema oscuro (fuera de alcance).

## 7. Entornos, despliegue y variables

| Entorno | Supabase | Uso |
|---------|----------|-----|
| dev | `calendario-dev` (ref `uthubyzhonrtrmbcqcjh`, eu-west-1) | `npm run dev` y `npm run test:db`. **El link local de la CLI debe apuntar siempre aquí** |
| prod | `calendario-prod` (ref `yznbdoskvtxeasujtirk`, eu-west-1) | Vercel. Site URL = URL de Vercel |

- Las funciones de Vercel corren en **Dublín (`dub1`)**, fijado en `vercel.json`, para estar junto a Supabase `eu-west-1`; en Washington cada consulta cruzaba el Atlántico y las páginas tardaban segundos. La mejora aún no está medida: si vuelve la lentitud, mira los logs de Vercel (duración y arranque en frío) antes de tocar código.
- Vercel despliega a producción cada push a **`main`** y hace previews de las demás ramas. Se trabaja en una rama por spec (`001-base-aplicacion`) y se integra en `main` con `git merge --ff-only`. `main` debe estar siempre desplegable.
- Para aplicar migraciones a prod (lo ejecuta el usuario):
  ```
  npx supabase link --project-ref yznbdoskvtxeasujtirk
  npx supabase db push
  npx supabase link --project-ref uthubyzhonrtrmbcqcjh   # volver a dev inmediatamente
  ```
- El cron de Vercel llama cada día a `/api/cron/keep-alive`, que hace una consulta mínima para que Supabase Free no pause el proyecto tras 7 días de inactividad.

Variables (documentadas en `.env.example`):

| Variable | Dónde | Notas |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, `.env.test.local`, Vercel | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, `.env.test.local`, Vercel | Pública (`sb_publishable_…`) |
| `CRON_SECRET` | Solo Vercel | Secreto del servidor |
| `SUPABASE_SECRET_KEY` | **Solo `.env.test.local`** | Crea y borra usuarios en `test:db`. Nunca en Vercel ni en `src/` |

`.env.local` y `.env.test.local` apuntan a **dev** y están ignorados por git. No los leas ni los muestres en la salida.

## 8. Comandos

```
npm run dev            # http://localhost:3000 (el usuario suele tenerlo abierto: usa otro puerto, p. ej. npx next start -p 3100)
npm run build && npm start
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run format         # prettier --write .   |  npm run format:check
npm test               # vitest proyecto unit (jsdom)        → npm test -- <filtro>
npm run test:db        # vitest proyecto db contra Supabase dev → npm run test:db -- <filtro>
npm run db:push        # aplica migraciones al proyecto enlazado (dev)
npm run db:types       # regenera src/types/database.ts
```

## 9. Patrones del código (síguelos)

- **`cacheComponents: true`:** cualquier lectura de cookies o sesión va en un componente `async` dentro de `<Suspense>`, con `await connection()` antes de crear el cliente (Supabase usa `Date.now()`). Ejemplo: `Greeting` y `Calendars` en `src/app/dashboard/page.tsx`. Leer `cookies()` fuera de `<Suspense>` rompe el build.
- **Cliente de Supabase por contexto:**
  - `@/lib/supabase/server` en Server Components, Actions y Route Handlers.
  - `@/lib/supabase/client` en Client Components.
  - `@/lib/supabase/proxy` solo en `src/proxy.ts`.
  - El cliente de `server` siempre lleva el tipo `Database`.
- **Permisos:** confía en RLS y filtra por `user_id` cuando necesites tu fila (p. ej. tu rol en `calendar_members`). No uses la clave secreta en la app.
- **Server Actions:** devuelven un estado tipado (`src/lib/auth/form-state.ts`) con `fieldErrors`, `formError` y `values` para conservar lo escrito; el éxito hace `redirect()` fuera del `try`.
- **UI:** reutiliza `Button`, `LinkButton`, `TextField` y `FormAlert`. Accesibilidad:
  - Etiqueta visible en cada campo.
  - Errores enlazados con `aria-describedby` y anunciados (`role="alert"`, `aria-live`).
  - Botones con `min-h-11`.
  - Todo usable solo con teclado.
- **Páginas dinámicas (spec 002):** el `page.tsx` es síncrono; `params`/`searchParams` son promesas que se esperan dentro de un componente `async` bajo `<Suspense>`. Los `[id]` inválidos o ajenos hacen `notFound()`.
- **Server Actions que escriben:** validan con `zod` en español, leen con `requireActionUser()` (`lib/calendar/queries.ts`; los componentes usan `requireUser()`, que añade `connection()`), traducen errores con `getCalendarErrorMessage`, y antes de `redirect()` llaman a `revalidatePath("/dashboard", "layout")`. Sin eso, tras redirigir se ve el dato viejo por la caché de rutas del cliente. RLS oculta las filas sin dar error: un `update`/`delete` que devuelve 0 filas se explica con `canSeeCalendar`/`canSeeEvent` ("ya no existe" frente a "sin permiso").
- **Formularios con React 19:** tras cada acción React reinicia los campos. Usa campos **no controlados** (`defaultValue` desde `state.values`) y deja `useState` solo para lo que cambia la interfaz (p. ej. ocultar horas); un campo controlado no recupera lo enviado.
- **Ids de campos:** `useId()`, nunca `field-${name}` (ver trampas).
- **Para valores que solo existen en el navegador** (zona horaria, user agent…), usa `useSyncExternalStore` con un snapshot de servidor, no `useEffect` con `setState` (evita el aviso de hidratación y la regla de lint).
- **Comentarios:** en inglés, breves, explicando el porqué y citando el requisito o la decisión del plan (`// ... (RF-26, plan D13)`).
- **Tests:**
  - Los de componentes usan Testing Library por rol o etiqueta, con los textos en español.
  - Los de Route Handlers usan `// @vitest-environment node` y mockean `@supabase/supabase-js`.
  - Los de integración crean y borran usuarios con `tests/integration/helpers.ts`.
- **Commits:** Conventional Commits en español con la tarea: `feat: registro de usuario (T7)`.

## 10. Trampas conocidas

- **Next.js 16 ≠ lo que conoces:** `middleware.ts` se llama `proxy.ts`; hay `cacheComponents`, `partialPrefetching` y `LayoutProps`/`PageProps` globales. Consulta `node_modules/next/dist/docs/` antes de usar una API.
- **Finales de línea:** la máquina tiene `core.autocrlf=true`. `.gitattributes` fuerza LF, y si `format:check` falla en masa por CRLF, `npx prettier --write .` lo arregla sin cambiar contenido. `docs/`, `specs/` y `AGENTS.md` están en `.prettierignore` (se redactan a mano).
- **`test:db` es intermitente:** a veces una llamada a Supabase dev se cuelga y un test da timeout (30 s). Es un problema conocido y no siempre cae en el mismo test: repite la ejecución antes de investigar el código. Mejora pendiente: añadir timeout o reintento en los helpers.
- **Con `cacheComponents`, Next conserva la página anterior oculta en el DOM** (Activity). Hay dos formularios a la vez tras navegar, así que los `id` fijos se duplican y `getByLabel` de Playwright da "strict mode violation": filtra con `.locator('visible=true')`. En producción no se nota para el usuario.
- **El reloj local va por delante del de la base de datos** (segundos): en los tests de integración, para "caducar" algo retrasa una hora, no un segundo.
- **En plpgsql `PERFORM` reinicia `FOUND`:** guarda `found` en una variable justo después del `SELECT INTO` (el fallo que corrigió `fix_join_with_code`).
- **Una migración aplicada no se edita:** la corrección va en otra (por eso hay `..._fix_join_with_code.sql`).
- **`useActionState` pasa `(prevState, formData)` a la acción**, también a las que se enlazan con `bind`; las de confirmar (`revokeInvite(id)`, `expelMember(calendarId, userId)`…) ignoran esos argumentos. En los tests mira `mock.calls[0][0]`, no `toHaveBeenCalledWith(id)`.
- **El PIN nunca vuelve al formulario:** las acciones que lo reciben devuelven `values.pin = ""`.
- **Al escribir ficheros con heredocs en Bash**, un apóstrofo o una comilla rara puede romper el comando entero; usa la herramienta Write o un script en un fichero.
- **Probar en un navegador real:** `playwright-cli` está instalado globalmente. Arranca la app compilada con `npx next start -p 3100`, crea el usuario de prueba por `/signup` y bórralo de `dev` al terminar. Un `check()` sobre un radio `sr-only` falla: haz clic en el círculo (`label span[aria-hidden]`).
- **jsdom no implementa `<dialog>.showModal()`:** los tests de diálogos lo simulan en un `beforeAll`.
- **Tras usar el link de prod**, vuelve a enlazar dev; si no, `db:types` o `db:push` irían contra producción.
- **`src/types/database.ts`** se regenera tras cada migración y no se formatea con Prettier.
- **Usuarios de prueba:** los tests los crean y borran solos. Si creas usuarios a mano en dev para probar, bórralos al terminar.
- La primera petición tras un despliegue en Vercel puede tardar varios segundos (arranque en frío). No lo confundas con un fallo.

## 11. Fuera de alcance hasta su spec

Eventos recurrentes (spec futura sin número, con edición de una ocurrencia o de toda la serie), arrastrar y soltar eventos, búsqueda y vista de agenda, papelera o deshacer, zona horaria por evento, juntar calendarios ajenos o importados, compartición e invitaciones (003), `.ics` (004), recuperación de contraseña, verificación y cambio de email, borrado de cuenta y edición de perfil (005), login social y OAuth (006), notificaciones, uso offline con datos, tema oscuro e i18n. No implementes nada de esto sin su spec aprobada.

## 12. Cómo continuar

La 003 está cerrada y desplegada en producción (migraciones aplicadas y demo validada). Siguiente spec (004, importación de `.ics`):

1. La rama es `004-importacion-ics` (desde `main`, con la 003 ya integrada).
2. Redacta `spec.md` con la skill `spec-generator` (entrevista al usuario) y espera su aprobación. La librería de parseo `.ics` exige aprobación explícita (P6).
3. Haz lo mismo con `plan.md` (`plan-generator`) y `tasks.md` (`tasks-generator`).
4. Implementa tarea a tarea con el test primero, el checklist de verificación y un commit por tarea.
5. Valida en producción y pide al usuario la aprobación para cerrar.
