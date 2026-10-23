<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CalendarioFamilia (CalenderFam) — guía para agentes

Contexto completo del proyecto para cualquier IA que empiece a trabajar en él. Léelo entero antes de tocar código. El bloque de arriba lo gestiona `next dev`: no lo edites; todo lo de debajo es documentación del proyecto y `next dev` lo respeta.

> Última actualización: 2026-10-23, al implementar la spec 006 (gestión de cuenta) en dev; pendiente de producción y cierre.

## 1. Qué es

**CalenderFam** (nombre corto **CaFam**) es una PWA de calendario compartido, mobile-first e instalable en iOS, Android y escritorio, para uso **estrictamente personal** entre familia y amigos. Cada usuario se registra, ve sus calendarios en un panel, crea eventos, los comparte con roles Lector/Editor (por enlace o por ID y PIN) e importa calendarios externos (Google, iCloud, Outlook) desde un enlace o archivo `.ics`.

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
| 004-importacion-ics | Importación única de un `.ics` (enlace o archivo) a un calendario propio editable y compartible | **Cerrada** (2026-10-22), T1–T11 hechas |
| 005-identidad-visual | Identidad visual propia en todas las pantallas, acento elegido por el usuario (6 colores), marco con barra lateral e inferior, vista agenda, mini calendario y próximo evento | **Cerrada** (2026-10-22), T1–T13 hechas |
| 006-gestion-de-cuenta | Recuperar y cambiar contraseña, cambiar email, editar perfil, borrar cuenta con calendarios sin propietario, autor del evento | **Implementada en dev** (2026-10-23), T1–T26; falta probar el cambio de email (T9), producción y cierre |
| 007-sincronizacion-oauth | Sincronización bidireccional por OAuth 2.0 (futura) | Pendiente |

Las specs 001–004 (cerradas, no se editan) citan la gestión de cuenta como "spec 005" y OAuth como "spec 006": hoy son la 006 y la 007.

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

Añadido por la spec 004 (`/dashboard/import`):

- Importar un `.ics` **una sola vez**, desde un enlace (`https://` o `webcal://`) o un archivo, y crear un calendario **nuevo** del usuario, editable y compartible. No se guarda el enlace ni el archivo y no se vuelve a sincronizar.
- Cada repetición de un evento repetido se crea como evento suelto (la app no tiene recurrentes propios): las series sin fin llegan hasta 1 año desde el día de la importación, y se respetan `EXDATE` y las repeticiones modificadas (`RECURRENCE-ID`). Los eventos cancelados no se importan.
- Límite de **2 MB y 2.000 eventos**. Los eventos con zona horaria no reconocida (típicamente los nombres de Windows de Outlook) o con fin anterior al inicio se omiten y se cuentan en el resumen.

Añadido por la spec 005:

- **Identidad visual propia** (constitución P9): fondo piedra, paneles papel, tinta casi negra, Inter Tight, botones negros redondos e iconos SVG propios. Una guardia de diseño (`tests/unit/design-tokens.test.ts`) impide volver a colores sueltos, `bg-white`, monoespaciada, degradados, sombras en reposo o emojis.
- **Color de acento** a elegir en **Ajustes** (`/dashboard/settings`) entre rojo (por defecto), azul, verde, amarillo, morado y gris. Se guarda en `profiles.accent` y se ve igual en todos los dispositivos; sin sesión, rojo. Solo marca hoy, la hora actual, los días de la semana, la vista elegida y el próximo evento.
- **Marco de la app** (`src/app/dashboard/layout.tsx`): barra lateral de iconos desde 1024 px; por debajo, barra inferior con Calendario, Mis calendarios, "+ Evento" y la hoja "Más" (Unirme, Importar, Ajustes, Cerrar sesión).
- **El calendario es la pantalla de inicio**: `/dashboard` redirige a `/dashboard/calendar` y la lista de calendarios pasa a `/dashboard/calendars` ("Mis calendarios").
- **Vista agenda** (por defecto): 14 días seguidos desde la fecha, con el número del día gigante, filas de evento (horas, barra de color, título, lugar), "Sin eventos", crear en cada día y la línea de la hora actual.
- **Panel del calendario**: tarjeta "Próximo evento" con cuenta atrás (siguiente evento con hora en 24 h), mini calendario mensual con puntos por calendario y filtros con avatares de iniciales.
- **Marca e iconos nuevos** ("CF" en piedra sobre tinta) y PWA en color piedra.

Añadido por la spec 006 (en dev; producción pendiente, ver `specs/006-gestion-de-cuenta/produccion.md`):

- **Recuperar contraseña** desde `/login` ("¿Olvidaste tu contraseña?" → `/forgot-password`): la respuesta es la misma exista o no la cuenta, con un límite de 3 enlaces cada 15 minutos por cuenta. El enlace del correo pasa por `/auth/confirm` y lleva a `/reset-password`; al guardar se cierran las demás sesiones.
- **Ajustes** (`/dashboard/settings`): perfil (nombre y zona horaria), cambio de email (pide la contraseña; queda pendiente hasta confirmar el enlace del email nuevo), cambio de contraseña (verifica la actual y cierra las demás sesiones) y borrar cuenta (email y contraseña).
- **Borrar la cuenta** borra los calendarios propios sin otros miembros. Los compartidos quedan **sin propietario** 15 días: sus miembros reciben un aviso en "Mis calendarios" y por correo, y deciden **Conservar** o **Salir**. Al decidir todos o vencer el plazo: con un solo conservador pasa a ser suyo; con varios, cada uno recibe una copia completa (con los autores originales); sin nadie, se borra. Mientras tanto aparecen en un grupo **"Sin propietario"** de los filtros y de "Mis calendarios", con los permisos de cada miembro sin cambios.
- **Autor del evento**: el detalle muestra "Creado por <nombre>", "Cuenta borrada" si el autor ya no existe y "un antiguo miembro" si salió del calendario.
- **Correo**: Brevo (plan gratuito, 300 al día). Auth envía recuperación y cambio de email por SMTP; los avisos de cuenta salen de Postgres con `pg_net` a la API de Brevo, con la clave en Vault.

**No hay** eventos recurrentes propios (spec futura sin número), sincronización ni actualización de lo importado.

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
- **Identidad visual (P9):** toda pantalla nueva o rediseñada sigue la sección "Identidad visual y diseño de interfaz" de la constitución (estilo de `docs/referencia.jpg`, solo local), usa solo tokens (la guardia `design-tokens.test.ts` lo comprueba) y se revisa con capturas a 390, 768 y 1440 px con el acento rojo y el amarillo. Para diseñar usa las skills `design-taste-frontend` (pantallas de aplicación), `frontend-design` y `web-design-guidelines`. Ver §6 "Identidad visual".
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

Dependencias de producción: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod` y `ical.js` (2.2.1, MPL-2.0, aprobada en la spec 004; solo se importa en `src/lib/ics/parse-ics.ts`). El `package.json` no debe crecer sin aprobación.

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
│   │   ├── globals.css        # @import "tailwindcss" + tokens (@theme) y los seis [data-accent]
│   │   ├── page.tsx           # portada pública "/" (con sesión redirige a /dashboard/calendar) + ayuda de instalación iOS
│   │   ├── manifest.ts        # /manifest.webmanifest
│   │   ├── icon.svg           # favicon (copia de public/icons/icon.svg)
│   │   ├── (auth)/            # grupo sin segmento de URL
│   │   │   ├── actions.ts     # Server Actions signUp, signIn, signOut
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── forgot-password/ # pedir enlace + actions.ts (requestRecovery) — spec 006
│   │   │   └── reset-password/  # contraseña nueva + actions.ts (resetPassword) — spec 006
│   │   ├── auth/confirm/route.ts  # verifica el token_hash de los correos de Auth (spec 006)
│   │   ├── dashboard/         # layout.tsx (marco con el acento), page.tsx (redirige al calendario); protegido por getRouteAccess
│   │   │   ├── calendar/      # vistas agenda/mes/semana/día (?view=&date=) + preferences-actions.ts + mini-month-actions.ts
│   │   │   ├── calendars/     # page.tsx ("Mis calendarios"), new, [id]/edit, [id]/categories, merge + actions.ts (calendarios y juntar)
│   │   │   ├── settings/      # Ajustes: acento + actions.ts (setAccent) y cuenta + account-actions.ts (spec 006)
│   │   │   └── events/        # new, [id] (detalle + edición + borrado) + actions.ts
│   │   ├── dashboard/join/    # "Unirme con código" (ID y PIN) + actions.ts
│   │   ├── dashboard/import/  # "Importar calendario" (.ics) + actions.ts (`maxDuration` 60)
│   │   ├── dashboard/calendars/[id]/share/    # invitaciones y ID/PIN (solo propietario) + actions.ts
│   │   ├── dashboard/calendars/[id]/members/  # lista de miembros (cualquier miembro) + actions.ts
│   │   ├── invite/[token]/    # vista previa y "Unirme" (ruta pública a nivel de proxy) + actions.ts
│   │   ├── offline/page.tsx   # "Sin conexión" + "Reintentar" (estática, la precachea el SW)
│   │   └── api/cron/keep-alive/route.ts  # GET protegido por CRON_SECRET
│   ├── components/
│   │   ├── ui/                # button (variantes), link-button, text-field, text-area, select, form-alert (solo tokens)
│   │   ├── shell/             # app-frame, side-rail, bottom-bar, more-sheet, bar-styles, icons (SVG propios)
│   │   ├── brand/             # logo (LogoMark y Logo)
│   │   ├── settings/          # accent-picker
│   │   ├── account/           # formularios de cuenta, diálogo de borrado, avisos, calendario sin propietario (spec 006)
│   │   ├── people/            # avatar
│   │   ├── auth/              # auth-card, login-form, signup-form (Client Components con useActionState)
│   │   ├── dashboard/         # calendar-list
│   │   ├── calendar/          # formularios, vistas (agenda-view, event-row, month/week/day, time-grid), mini-month, next-event-card, filtros, workspace, merge-form, confirm-dialog…
│   │   ├── sharing/           # invite-form, copy-button, invite-list, access-code-panel, member-list, join-code-form, invite-join-card
│   │   ├── import/            # import-form, import-summary
│   │   └── pwa/               # service-worker-register, retry-button, ios-install-hint
│   ├── lib/
│   │   ├── auth/              # schemas.ts (zod), error-messages.ts, form-state.ts, route-access.ts, next-path.ts (destino tras login: solo /invite/<token>)
│   │   ├── calendar/          # LÓGICA PURA testeada: palette, time-zone, ranges, layout, agenda, month-marks, next-event, grouping, format, schemas, error-messages; queries.ts (lecturas con RLS)
│   │   ├── theme/             # accents.ts: los seis acentos y los neutros (fuente de los valores de globals.css)
│   │   ├── shell/             # nav.ts: destinos y sección activa
│   │   ├── people/            # avatar.ts: iniciales y tintes
│   │   ├── hooks/             # use-now.ts: reloj compartido (30 s y al volver a primer plano)
│   │   ├── sharing/           # schemas, error-messages, merge-access, invite-url, roles (puros) y queries.ts (lecturas con RLS)
│   │   ├── ics/               # importación .ics: limits, source-url, ip-guard, fetch-ics, read-source, parse-ics (única que importa ical.js), convert-events, import-calendar (orquesta), schemas, error-messages, import-state
│   │   ├── forms/             # form-state.ts: FormState genérico, ConfirmState, ParseResult, readString
│   │   └── supabase/          # env.ts, server.ts, client.ts, proxy.ts
│   └── types/database.ts      # GENERADO con `npm run db:types`; no editar a mano
├── public/
│   ├── sw.js                  # service worker propio
│   └── icons/                 # icon.svg (maestro) → icon-192, icon-512, icon-512-maskable (letras al 85 %), apple-touch-icon
├── supabase/
│   ├── config.toml
│   └── migrations/            # 001: base_schema, rls_policies · 002: calendars_and_events, merge_calendars · 003: sharing_tables_and_policies, members_with_names, invite_functions, access_code_functions, fix_join_with_code · 004: import_calendar · 005: profile_accent, remove_old_blue · 006: account_orphan_schema, account_recovery_limit, delete_own_account, decide_orphan_calendar, copy_calendar_for_owner, apply_orphan_decisions, account_mail_jobs, account_notices_read, skip_test_addresses
├── tests/
│   ├── setup-unit.ts
│   ├── fixtures/ics/          # .ics sintéticos al estilo Google, iCloud y Outlook (nunca calendarios reales)
│   ├── unit/                  # *.test.ts(x): lógica pura, formularios, vistas, filtros, sw-no-data, no-secrets…
│   └── integration/           # schema, rls, signup, login, calendars-events, merge-calendars, preferences, profile-accent, remove-old-blue, range-performance contra Supabase dev + helpers.ts
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
| `/` | pública | Portada; con sesión redirige a `/dashboard/calendar` (lo hace la página, no el proxy) |
| `/signup`, `/login` | solo sin sesión (con sesión → `/dashboard/calendar`) | Formularios; aceptan `?next=`, que solo se sigue si es `/invite/<token>` (campo oculto leído en el cliente) |
| `/dashboard` y subrutas | solo con sesión (sin sesión → `/login`) | Todas dentro del marco (`dashboard/layout.tsx`). `/dashboard` redirige a `/dashboard/calendar` |
| `/dashboard/calendar` | con sesión | Vistas `?view=agenda\|month\|week\|day&date=YYYY-MM-DD` (valores inválidos → agenda desde hoy) |
| `/dashboard/calendars` | con sesión | "Mis calendarios": la lista con crear, importar, unirme y juntar |
| `/dashboard/settings` | con sesión | Ajustes: color de acento |
| `/dashboard/calendars/new`, `/[id]/edit`, `/[id]/categories`, `/merge` | con sesión | Calendarios, categorías y juntar. `edit` solo propietario, `categories` propietario o editor; otros → 404 |
| `/dashboard/events/new`, `/dashboard/events/[id]` | con sesión | Alta (`?calendar=&date=`) y detalle con edición y borrado |
| `/dashboard/calendars/[id]/share` | solo propietario (otros → 404) | Invitaciones por enlace e ID y PIN |
| `/dashboard/calendars/[id]/members` | cualquier miembro (ajeno → 404) | Lista de miembros; controles según el rol |
| `/dashboard/join` | con sesión | Unirme con ID y PIN |
| `/dashboard/import` | con sesión | Importar un `.ics` (enlace o archivo) a un calendario nuevo |
| `/invite/[token]` | sin sesión → `/login?next=/invite/<token>`; con sesión, vista previa | Cabeceras `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` |
| `/offline` | pública | Pantalla sin conexión |
| `/forgot-password` | pública | Pedir el enlace de recuperación (spec 006); `?expired=1` avisa de un enlace caducado |
| `/reset-password` | solo con sesión (la crea el enlace; sin sesión → `/login`) | Contraseña nueva |
| `/auth/confirm` | pública (Route Handler) | `verifyOtp` con `token_hash`: `type=recovery` → `/reset-password`, `type=email_change` → `/dashboard/settings`; nunca lee `next` |
| `/manifest.webmanifest`, `/sw.js`, `/icons/*` | pública | PWA |
| `/api/cron/keep-alive` | `Authorization: Bearer ${CRON_SECRET}` | `200 {"ok":true}` / `401` / `500` |

La decisión de acceso es una función pura, `getRouteAccess(pathname, hasSession)`, en `src/lib/auth/route-access.ts` (testeada en `route-access.test.ts`). Para proteger una ruta nueva se cambia **ahí**, no en cada página. El `matcher` de `src/proxy.ts` excluye estáticos, `sw.js` y el manifest.

### Autenticación

- `signUp` valida con `signUpSchema` (email normalizado a minúsculas sin espacios; contraseña de 8 a 72 caracteres; nombre de 1 a 50) y llama a `supabase.auth.signUp` con los metadatos `display_name` y `time_zone`. La zona horaria la detecta el navegador (`Intl`) en un campo oculto; si no es válida se descarta y Postgres aplica `Europe/Madrid`.
- **"Confirm email" está desactivado** en Supabase (no hay SMTP hasta la spec 006), así que el registro devuelve sesión y redirige a `/dashboard/calendar`. El registro es abierto (cualquiera con la URL).
- Los errores de Supabase se traducen en `src/lib/auth/error-messages.ts`; un código desconocido o un error de red se convierte en "No se ha podido conectar…".
- Los formularios usan `useActionState`, `noValidate` (los errores vienen del servidor en español) y desactivan el botón mientras la acción está pendiente.
- `signOut` usa `scope: "local"` y redirige a `/login`.

### Base de datos (`supabase/migrations/`)

- Enum `calendar_role`: `owner | editor | viewer` (en la UI: Propietario, Editor, Lector).
- Tablas: `profiles` (1:1 con `auth.users`: `display_name`, `time_zone`), `calendars` (`owner_id`, `name`, `description`, `color`, por defecto Azul cielo `#A0C4FF` desde la spec 005), `calendar_members` (PK `calendar_id + user_id`, `role`; **el propietario también tiene su fila `owner`**, con un solo owner por calendario) y `events` (`starts_at`/`ends_at` en `timestamptz` con `ends_at >= starts_at`, `all_day`, `created_by`). Todas tienen `created_at` y, las editables, `updated_at`.
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
- Añadido por la spec 005: el azul antiguo de la spec 001 desaparece (migración `remove_old_blue`): el valor por defecto de `calendars.color` y el respaldo de `merge_calendars` e `import_calendar` pasan a `#A0C4FF`, y los calendarios y eventos con el azul antiguo se cambiaron a ese color. La guardia de diseño prohíbe el código del azul antiguo en `src/`.
- Añadido por la spec 006:
  - `calendars.owner_id` es anulable y hay `calendars.orphaned_at` (`check`: propietario nulo si y solo si hay fecha). `prevent_owner_change` solo deja cambiar el propietario con la marca de transacción `app.account_transfer`, que activan las funciones de cuenta.
  - Tablas (todas con RLS): `calendar_orphan_decisions` (lectura propia), `account_notices` (lectura propia y `UPDATE (read_at)` propio), `email_outbox` y `auth_email_requests` (sin acceso de clientes; la segunda solo guarda SHA-256 del email).
  - Funciones `SECURITY DEFINER`: `request_recovery` (anon), `delete_own_account` (borra `auth.users` del llamante tras dejar sin propietario los calendarios compartidos), `decide_orphan_calendar`, y solo para `postgres` y `service_role`: `copy_calendar_for_owner`, `apply_orphan_decisions`, `send_pending_emails` (con `p_dry_run` para tests) y `account_scheduled_jobs` (ayuda de tests). `CF404` vuelve a significar "no válido para ti".
  - `pg_cron`: `account-apply-orphans` (03:00 UTC), `account-send-emails` (cada 15 min) y `account-purge-recovery` (04:00 UTC). `pg_net` es asíncrono: un correo se marca enviado cuando una ejecución posterior lee un 2xx en `net._http_response`; hasta 5 intentos. Nunca envía a direcciones `.test`.
  - Vault: `brevo_api_key` y `brevo_sender_email` (los crea el usuario en el SQL Editor de cada proyecto).
- Añadido por la spec 005: `profiles.accent` (`text`, por defecto `'red'`, `check` en `red|blue|green|yellow|purple|gray`). La protegen las políticas de `profiles` (solo el propio); `visible_people()` y `calendar_members_with_names` no la exponen.
- Añadido por la spec 004: `import_calendar(p_name, p_color, p_events jsonb)` (`SECURITY INVOKER`, una transacción): crea el calendario del llamante y sus eventos desde un array de 1 a 2.000 elementos (`22023` si no) y, si un evento viola una restricción, no deja nada. No hay tablas ni columnas nuevas: el calendario importado no guarda nada de su origen.
- **Cambios de esquema solo mediante una migración nueva** en `supabase/migrations/` (nunca editando el panel ni migraciones ya aplicadas). Después: `npm run db:push` (dev), `npm run db:types` y tests en `tests/integration/`.
- La evolución prevista (`calendar_invites`, `calendar_access_codes`, …) está en el Anexo A de `specs/001-base-aplicacion/plan.md`.

### PWA

- Manifest: CalenderFam/CaFam, `theme_color` y `background_color` piedra `#E8E5DD` (de `NEUTRALS.stone`), `start_url /dashboard/calendar`, `standalone`, iconos 192, 512 y 512 maskable generados desde `public/icons/icon.svg`. El favicon (`/icon.svg`) se enlaza explícitamente en `metadata.icons`: la convención de archivo sola no dejaba `<link rel="icon">`.
- iOS: `appleWebApp` en `layout.tsx` + `apple-touch-icon`. La portada muestra la ayuda "Compartir › Añadir a pantalla de inicio" **solo** en Safari iOS.
- `public/sw.js`:
  - Precachea `/offline`, los iconos y los `/_next/static/` que referencia `/offline`.
  - En navegaciones usa red primero, con `/offline` como respaldo.
  - Usa caché primero para `/_next/static/` e `/icons/`.
  - **Nunca cachea HTML con sesión ni respuestas de Supabase** (privacidad en dispositivos compartidos).
  - **Si cambias `sw.js` o los iconos, sube `CACHE_NAME`** (`calenderfam-vN`; ahora `v2`).
  - Se registra solo en producción.

### Identidad visual

Reglas completas en la constitución ("Identidad visual y diseño de interfaz", P9), inspiradas en `docs/referencia.jpg` (solo local, en `.gitignore`). Lo que hay en el código:

- **Tokens** en `src/app/globals.css`, con los valores de `src/lib/theme/accents.ts` (`accents.test.ts` los mantiene iguales):
  - Neutros (`@theme`): `stone #E8E5DD` (fondo), `paper #F2F0EA` (paneles), `ink #141414` (texto), `muted #66635D` (secundario, 4,5:1), `line #D6D1C4` (separadores), `control #857F75` (bordes de campos, 3:1) y `danger #B42318`.
  - Acento (`@theme inline`): `accent` (relleno), `on-accent` (texto encima), `accent-ink` (texto y líneas sobre piedra o papel) y `accent-edge` (borde de un relleno; en amarillo es oscuro porque el relleno no se distingue del fondo). Cada `[data-accent=…]` redefine las variables; `:root` es rojo para las páginas sin sesión.
- **El acento** lo pinta `AppFrame` con `data-accent` (y `data-app-frame`, que usa el selector de Ajustes para repintar sin recargar). Úsalo solo para hoy, la hora actual, los días de la semana, la selección y el próximo evento. Texto y líneas, siempre `accent-ink`; sobre un relleno `bg-accent`, siempre `text-on-accent` y `border-accent-edge`.
- **Colores de calendario** (paleta pastel de la spec 002): solo como marca (barra `border-l-4`, punto o barra de 4 px con contorno `ink/15`); el texto del evento siempre en tinta.
- **Tipografía**: Inter Tight (`next/font`, cifras tabulares comprobadas) para todo; `tabular-nums` en horas, fechas y contadores; sin monoespaciada.
- **Forma**: superficies separadas por tono (piedra/papel), paneles `rounded-3xl`, botones y controles `rounded-full`; sombras solo en lo que flota (diálogos, hoja "Más", tooltips de la barra).
- **Componentes base**: `Button`/`LinkButton` primario negro, secundario papel con borde `control`; campos `bg-paper` con borde `control`. Iconos: SVG propios en `components/shell/icons.tsx`.
- Sin tema oscuro (fuera de alcance).

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
- **Correo (spec 006)**: SMTP de Brevo y plantillas de Auth (`token_hash` → `/auth/confirm`) se configuran en el panel de cada proyecto; las claves de Brevo para los avisos van en Vault. Pasos exactos en `specs/006-gestion-de-cuenta/produccion.md`. En Brevo, la restricción de IP debe estar desactivada (Supabase llama desde IPs variables).
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
- **Identidad visual:** solo tokens (`bg-paper`, `text-muted`, `bg-accent`…); nada de `bg-white`, colores de la paleta de Tailwind ni hex en clases (la guardia `design-tokens.test.ts` falla). Un color que viene de datos (calendario, avatar) va en `style`.
- **Hora actual en el cliente:** `useNow()` (`lib/hooks/use-now.ts`), compartido y con `useSyncExternalStore`. En un Server Component no llames a `Date.now()` en el cuerpo (regla de lint de React): sácalo a una función de `lib/` (p. ej. `nextEventsWindow()`).
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
- **`ical.js` deja los eventos con `TZID` como hora "de pared" sin zona** (aunque el archivo traiga `VTIMEZONE`): `parse-ics.ts` lee el `TZID` del parámetro y `convert-events.ts` lo convierte con `zonedLocalToUtc`, una vez por ocurrencia. Un `TZID` que `Intl` no reconoce se omite.
- **La descarga del enlace usa `node:https` con un `lookup` propio** que valida la IP al conectar (anti-SSRF, anti DNS rebinding). No la cambies por `fetch`.
- **PostgREST devuelve como mucho 1.000 filas por consulta**: en tests con más, cuenta con `{ count: "exact", head: true }`.
- **`user.upload` de user-event no llega al `FormData` de jsdom** (sustituye `input.files`): un test de un formulario con archivo no puede comprobar el archivo recibido; se comprueba en el navegador.
- **El cuerpo de las Server Actions está limitado** (`serverActions.bodySizeLimit` en `next.config.ts`, 3 MB por la importación); más que eso lo rechaza Next antes de la acción.
- **Un script de verificación no debe seguir tras un fallo:** comprueba la salida de `typecheck` antes de hacer commit.
- **Probar en un navegador real:** `playwright-cli` está instalado globalmente. Arranca la app compilada con `npx next start -p 3100`, crea el usuario de prueba por `/signup` y bórralo de `dev` al terminar. Un `check()` sobre un radio `sr-only` falla: haz clic en el círculo (`label span[aria-hidden]`).
- **jsdom no implementa `<dialog>.showModal()`:** los tests de diálogos lo simulan en un `beforeAll`.
- **Tras usar el link de prod**, vuelve a enlazar dev; si no, `db:types` o `db:push` irían contra producción.
- **`src/types/database.ts`** se regenera tras cada migración y no se formatea con Prettier.
- **Usuarios de prueba:** los tests los crean y borran solos. Si creas usuarios a mano en dev para probar, bórralos al terminar.
- La primera petición tras un despliegue en Vercel puede tardar varios segundos (arranque en frío). No lo confundas con un fallo.
- **`LayoutProps<"/ruta">` de una ruta nueva** no existe hasta que Next genera los tipos (build o `next typegen`): `typecheck` falla antes del build. En layouts nuevos tipa `children` a mano.
- **`hidden` en el `className` de `LinkButton` no oculta**: su `inline-flex` gana. Para ocultarlo por tamaño envuélvelo en un `div` (`hidden lg:block`).
- **Tests de formularios con error**: `findByLabelText` encuentra el campo antes de que llegue la respuesta de la acción; espera al mensaje (`findByText`) antes de comprobar `aria-describedby`, o el test falla de forma intermitente con la máquina cargada.
- **Cookie de un usuario borrado**: `getClaims()` valida el JWT sin consultar la base de datos, así que en `playwright-cli` sigues "con sesión" tras borrar el usuario de prueba. Limpia las cookies (`page.context().clearCookies()`) antes de registrar otro.
- **Icono de la app instalada**: iOS no lo cambia hasta volver a añadir la app a la pantalla de inicio; Android lo actualiza cuando revisa el manifest. Lo que sí se renueva al publicar es lo que guarda el service worker (`CACHE_NAME`).
- **La carpeta `.playwright-cli/`** (capturas de la herramienta) no está ignorada: bórrala al terminar o `format:check` falla.
- **Tailwind 4 solo busca clases en `src/`** (`@import "tailwindcss" source("..")` en `globals.css`). Sin eso escanea todo el repositorio y convierte en CSS los ejemplos de la documentación (así se coló el azul antiguo `bg-[#…]` en producción).

## 11. Fuera de alcance hasta su spec

Eventos recurrentes (spec futura sin número, con edición de una ocurrencia o de toda la serie), arrastrar y soltar eventos, búsqueda (la vista agenda llega con la spec 005), papelera o deshacer, zona horaria por evento, sincronizar o actualizar un calendario importado, importar a un calendario que ya existe, exportar a `.ics`, verificación de email en el registro, traspaso voluntario de calendarios, exportar los datos de la cuenta, login social y OAuth (007), notificaciones, uso offline con datos, tema oscuro e i18n. No implementes nada de esto sin su spec aprobada.

## 12. Cómo continuar

La spec 006 está implementada en dev en la rama `006-gestion-de-cuenta` (T1–T26; detalle y validación RF por RF en `specs/006-gestion-de-cuenta/tasks.md`). Falta:

1. Probar el cambio de email con una dirección real del usuario (T9).
2. Que el usuario aplique la spec en producción siguiendo `specs/006-gestion-de-cuenta/produccion.md` (migraciones, Vault, Auth, merge a `main`).
3. Validar en producción y pedir al usuario la aprobación para cerrar la spec.

Después, la spec 008 (mejoras de experiencia) está aprobada en `specs/008-mejoras-de-experiencia/` y le faltan plan y tareas; la 007 (OAuth) sigue pendiente.
