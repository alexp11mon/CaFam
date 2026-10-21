# Plan 003 — Compartición de calendarios

> Spec de origen: `specs/003-comparticion/spec.md` (aprobada). Constitución: `docs/constitution.md`. Estado: **Aprobado** (2026-10-21).

## Resumen de arquitectura

Se amplía el monolito de las specs 001 y 002 sin dependencias nuevas de npm. La frontera de seguridad sigue siendo la base de datos: unirse a un calendario solo es posible mediante funciones SQL `SECURITY DEFINER` que comprueban el enlace o el PIN, y cambiar roles, expulsar y abandonar se hacen con políticas RLS sobre `calendar_members`. Los secretos (token de invitación y PIN) solo existen como hash en la base de datos y los límites de intentos viven en una tabla que ningún cliente puede leer. La interfaz son páginas bajo `/dashboard` más una ruta pública, `/invite/[token]`, que lleva al login y devuelve a la invitación.

```
Propietario ── /dashboard/calendars/[id]/share ──▶ Server Actions ──▶ rpc create_invite · revoke_invite
                                                                       rpc set_access_code · disable_access_code
           ── /dashboard/calendars/[id]/members ─▶ Server Actions ──▶ update/delete calendar_members (RLS)
Invitado   ── /invite/[token] (sin sesión → /login?next=…) ──▶ rpc get_invite_preview → botón "Unirme" → rpc accept_invite
           ── /dashboard/join ──▶ rpc join_with_code (límites 5/persona y 20/ID en join_attempts)
Todos      ── lista de miembros ──▶ rpc calendar_members_with_names (solo nombre y rol, sin email)
Juntar     ── /dashboard/calendars/merge ──▶ calendar_members_with_names → aviso de quién pierde y quién gana acceso
```

## Módulos y responsabilidades

### SQL (migraciones nuevas, nunca se editan las ya aplicadas)

- `sharing_tables_and_policies`: tablas `calendar_invites`, `calendar_access_codes` y `join_attempts` con RLS, permisos por columna que ocultan los hashes, políticas de UPDATE y DELETE sobre `calendar_members` y el trigger que limpia las preferencias de quien deja de ser miembro. No contiene lógica de unión. Cubre: RF-11, RF-16, RF-24 (lectura), RF-25 a RF-31.
- `invite_functions`: `create_invite`, `revoke_invite`, `get_invite_preview` y `accept_invite`. Solo hablan de enlaces; no tocan PIN ni intentos. Cubre: RF-1, RF-3, RF-4, RF-5, RF-6, RF-8, RF-9, RF-10, RF-12, RF-13, RF-29.
- `access_code_functions`: `set_access_code`, `disable_access_code` y `join_with_code`, con la comprobación de límites. No hablan de enlaces. Cubre: RF-14 a RF-23, RF-29.
- `members_with_names`: `calendar_members_with_names(uuid[])`, única vía para ver nombres de otros miembros. Cubre: RF-24, RF-36, RF-37.
- `merge_calendars` (spec 002) **no cambia**: al borrar los calendarios origen caen en cascada sus miembros, y el destino conserva los suyos. Se añade solo un test. Cubre: RF-38.

### Lógica pura y acceso a datos (`src/lib/sharing/` y `src/lib/auth/`)

- `sharing/schemas.ts`: esquemas `zod` del rol (Lector o Editor), del número de usos (1 a 20), del PIN (6 a 10 dígitos), del ID y del cambio de rol. Cubre: RF-1, RF-3, RF-14, RF-15, RF-25.
- `sharing/error-messages.ts`: traduce los códigos de error y los estados de `join_with_code` a los mensajes de la spec. No decide permisos. Cubre: RF-8, RF-19 a RF-22, RF-28, RF-29.
- `sharing/queries.ts`: lecturas con RLS de invitaciones vigentes, ID y rol del código, miembros con nombre y vista previa de una invitación. Cubre: RF-5, RF-11, RF-16, RF-24.
- `sharing/merge-access.ts`: función pura que, dados los calendarios elegidos, el destino y sus miembros, devuelve quién pierde el acceso y quién pasa a ver eventos nuevos. Cubre: RF-36, RF-37.
- `sharing/invite-url.ts`: construye el enlace absoluto a partir del origen de la petición y el token. Cubre: RF-1, RF-2.
- `auth/next-path.ts`: decide si un `next` es válido (solo `/invite/<token>`) y, si no, devuelve `/dashboard`. Cubre: RF-7.
- `auth/route-access.ts` (modificado): un visitante sin sesión que abre `/invite/…` va a `/login` con `next`. Cubre: RF-7.

### Server Actions

- `dashboard/calendars/[id]/share/actions.ts`: `createInvite`, `revokeInvite`, `saveAccessCode` y `disableAccessCode`. Cubre: RF-1 a RF-4, RF-12, RF-14 a RF-18.
- `dashboard/calendars/[id]/members/actions.ts`: `changeMemberRole`, `expelMember` y `leaveCalendar`. Cubre: RF-25 a RF-28, RF-30, RF-31.
- `dashboard/join/actions.ts`: `joinWithCode`. Cubre: RF-19 a RF-23.
- `invite/[token]/actions.ts`: `acceptInvite`. Cubre: RF-6, RF-9, RF-10, RF-13.
- `(auth)/actions.ts` (modificado): `signIn` y `signUp` redirigen al `next` válido en lugar de a `/dashboard`. Cubre: RF-7.

### Páginas

- `/dashboard/calendars/[id]/share` (solo propietario; el resto, 404): crear invitaciones, ver y revocar las vigentes y gestionar el ID y el PIN. Cubre: RF-1, RF-2, RF-11, RF-12, RF-14 a RF-18, RF-29.
- `/dashboard/calendars/[id]/members` (cualquier miembro): lista de miembros; controles de rol y expulsar para el propietario; "Salir" para los demás. Cubre: RF-24 a RF-29.
- `/dashboard/join`: formulario ID y PIN. Cubre: RF-19 a RF-23, RF-35.
- `/invite/[token]` (pública a nivel de ruta): vista previa y botón "Unirme". Cubre: RF-5 a RF-9.
- `/dashboard` (modificada): accesos "Unirme con código", "Compartir y miembros" y "Miembros / Salir". Cubre: RF-33 a RF-35.
- `/dashboard/calendars/merge` (modificada): carga los miembros y pasa el resumen al formulario. Cubre: RF-36, RF-37.

### Componentes (`src/components/sharing/`, uno por responsabilidad)

- `invite-form`: crea la invitación y muestra el enlace una sola vez con su botón. Cubre: RF-1 a RF-3.
- `copy-button`: copia el enlace al portapapeles; si no hay permiso, deja el texto seleccionado. Cubre: RF-2.
- `invite-list`: invitaciones vigentes con rol, usos restantes y caducidad, y revocar con confirmación. Cubre: RF-11, RF-12.
- `access-code-panel`: muestra el ID, activa, cambia el PIN y desactiva. Cubre: RF-14 a RF-18.
- `member-list`: nombres y roles; cambio de rol y expulsión con confirmación para el propietario; abandonar con confirmación para los demás. Cubre: RF-24 a RF-28.
- `join-code-form`: ID y PIN con los mensajes de la spec. Cubre: RF-19 a RF-23.
- `invite-join-card`: datos de la invitación y botón "Unirme". Cubre: RF-5, RF-6, RF-8, RF-9.
- `auth/next-field`: campo oculto `next` leído en el cliente. Cubre: RF-7.
- `calendar-list` (modificado) y `merge-form` (modificado, con el aviso de miembros). Cubren: RF-33, RF-34, RF-36, RF-37.

No hacen: nada envía correos ni notificaciones, no hay roles nuevos y los Editores nunca llaman a las funciones de gestión.

## Modelo de datos

Todas las tablas nuevas con RLS activado, `created_at` y, si son editables, `updated_at`. Convención de nombres de la constitución (snake_case, plural). La extensión `pgcrypto` ya viene con Supabase Free (esquema `extensions`) y no es una dependencia de npm; la migración la declara con `create extension if not exists`.

### Tablas nuevas

- `calendar_invites { id uuid pk, calendar_id → calendars on delete cascade, token_hash bytea único, role calendar_role (solo editor o viewer), max_uses int 1..20, use_count int ≥ 0 y ≤ max_uses, created_by → profiles, expires_at timestamptz, revoked_at timestamptz null, created_at }`. El token en claro nunca se guarda.
- `calendar_access_codes { calendar_id pk → calendars on delete cascade, public_code text único (8 caracteres), pin_hash text, role calendar_role (editor o viewer), enabled boolean, created_at, updated_at }`.
- `join_attempts { id bigint identidad, user_id → profiles on delete cascade, code text (ID normalizado, hasta 32 caracteres), created_at }` con índices `(user_id, created_at desc)` y `(code, created_at desc)`. Solo guarda intentos **fallidos**.

### Permisos y políticas

| Tabla | Leer | Escribir |
|-------|------|----------|
| `calendar_invites` | Solo el propietario, y solo las columnas sin `token_hash` (permiso por columna) | Nadie directamente; solo por funciones |
| `calendar_access_codes` | Solo el propietario, sin `pin_hash` | Nadie directamente; solo por funciones |
| `join_attempts` | Nadie | Nadie directamente; solo `join_with_code` |
| `calendar_members` | Los miembros (sin cambios) | UPDATE solo de la columna `role` y solo por el propietario sobre filas que no son `owner`, con nuevo rol Lector o Editor; DELETE por el propietario sobre filas que no son `owner` o por cualquier usuario sobre su propia fila si no es `owner`; INSERT sigue sin política |

`anon` no tiene acceso a nada de esto. Las funciones se crean con `search_path = ''`, se revocan a `public` y `anon` y se conceden solo a `authenticated`.

### Trigger

- Tras borrar una fila de `calendar_members`, se borran las preferencias de visibilidad y orden de ese usuario para ese calendario (RF-31). Los eventos y categorías no se tocan porque no dependen de la membresía (RF-30).

### Funciones SQL (contratos)

| Función | Quién | Resultado | Errores |
|---------|-------|-----------|---------|
| `create_invite(p_calendar_id, p_role, p_max_uses)` | propietario | `token` en claro, una sola vez; guarda su SHA-256; caduca a los 7 días | `42501` no propietario, `22023` datos inválidos |
| `revoke_invite(p_invite_id)` | propietario | marca `revoked_at` | `42501` |
| `get_invite_preview(p_token)` | con sesión | nombre del calendario, nombre del propietario, rol y si ya es miembro; sin filas si no es válida | — |
| `accept_invite(p_token)` | con sesión | `calendar_id`; si ya es miembro no consume uso | `CF404` no válida |
| `set_access_code(p_calendar_id, p_role, p_pin)` | propietario | `public_code`; activa y guarda el PIN con bcrypt | `42501`, `22023` |
| `disable_access_code(p_calendar_id)` | propietario | `enabled = false` | `42501` |
| `join_with_code(p_code, p_pin)` | con sesión | fila `(status, calendar_id)` con `status` en `ok`, `member`, `invalid` o `limited` | — |
| `calendar_members_with_names(p_calendar_ids)` | miembro de cada calendario pedido | `(calendar_id, user_id, display_name, role)`; solo calendarios donde el llamante es miembro | — |

Reglas de `join_with_code` (devuelve un estado en vez de lanzar un error, para que el intento fallido no se deshaga con la transacción, D4):
1. Se normaliza el ID (mayúsculas, sin espacios exteriores) y el PIN (sin espacios exteriores). Se borran los intentos de más de un día.
2. Si los 5 últimos fallos de la persona caben en 15 minutos y el último tiene menos de 15 minutos, `limited` sin registrar nada. Igual con los 20 últimos fallos del mismo ID (RF-21, RF-22).
3. Si el ID no existe, está desactivado o el PIN no tiene 6 a 10 dígitos o no coincide, se registra un fallo y se devuelve `invalid`. Si el ID no existe se compara contra un hash falso para igualar el tiempo de respuesta.
4. Si coincide y ya es miembro, `member`; si no, se inserta la membresía y `ok`.

`accept_invite` bloquea la fila de la invitación (`for update`), recomprueba que sigue siendo válida (no revocada, no caducada, con usos) y que la persona no es ya miembro, incrementa el uso e inserta la membresía. Así dos personas que compiten por el último uso se serializan (RF-13).

## Contratos e interfaces

### Rutas

| Ruta | Acceso | Notas |
|------|--------|-------|
| `/invite/[token]` | Sin sesión → `/login?next=/invite/<token>`; con sesión, vista previa | `Referrer-Policy: no-referrer` y `noindex` |
| `/dashboard/join` | Con sesión | Formulario ID y PIN |
| `/dashboard/calendars/[id]/share` | Propietario; otros → 404 | Invitaciones y ID + PIN |
| `/dashboard/calendars/[id]/members` | Cualquier miembro; ajeno → 404 | Controles según el rol |
| `/login`, `/signup` | Aceptan `?next=` | Solo se sigue si es `/invite/<token>` |

### Estado de las Server Actions

Mismo patrón que la spec 002 (`FormState` con `fieldErrors`, `formError` y `values`, `redirect()` fuera del `try`, `revalidatePath("/dashboard", "layout")` antes de redirigir). `createInvite` devuelve además la URL del enlace, que solo vive en el estado del formulario. `joinWithCode` traduce el estado `invalid` o `limited` en mensaje; `ok` y `member` redirigen a `/dashboard/calendar`.

### Campos de formularios

- Invitación: `role` (`viewer` o `editor`), `maxUses` (1 a 20).
- ID y PIN del propietario: `role` y `pin` (6 a 10 dígitos). El ID lo asigna el sistema.
- Unirme con código: `code` y `pin`.
- Cambio de rol: `userId` y `role`.

### Mensajes de error (español)

| Origen | Mensaje |
|--------|---------|
| invitación no válida (`CF404` o sin filas) | "Esta invitación ya no es válida." |
| `invalid` | "ID o PIN incorrectos." |
| `limited` | "Demasiados intentos. Espera 15 minutos y vuelve a probar." |
| PIN fuera de 6 a 10 dígitos (al elegirlo) | "El PIN debe tener entre 6 y 10 dígitos." |
| usos fuera de 1 a 20 | "Elige entre 1 y 20 usos." |
| propietario intenta abandonar o expulsarse | "El propietario no puede salir de su calendario ni ser expulsado. Para dejar de serlo, borra el calendario." |
| sin permiso (`42501`) | "No tienes permiso para hacer esto." |

### Resumen de juntar con miembros

`merge-access` devuelve `{ losing: nombres[], gaining: nombres[] }`: pierden el acceso los miembros (distintos del propietario) de los calendarios que desaparecen que no son miembros del destino; ganan visibilidad los miembros del destino existente (distintos del propietario). Con un destino nuevo, nadie gana.

## Flujo principal paso a paso

1. **Compartir por enlace.** El propietario abre `/share`, elige rol y usos (RF-1, RF-3) → `create_invite` guarda el hash y devuelve el token → la acción construye la URL y la muestra con "Copiar enlace" (RF-2). La lista muestra las vigentes (RF-11) y permite revocar (RF-12).
2. **Abrir el enlace sin sesión.** El proxy redirige `/invite/<token>` a `/login?next=/invite/<token>` (RF-7); `signIn` o `signUp` validan `next` y redirigen a la invitación.
3. **Vista previa.** Con sesión, `get_invite_preview` devuelve calendario, propietario y rol sin modificar nada (RF-5). Si no hay filas: "Esta invitación ya no es válida." (RF-8). Si ya es miembro: aviso y enlace al calendario sin consumir uso (RF-9).
4. **Unirme.** El botón lanza `acceptInvite` (POST) → `accept_invite` consume un uso y crea la membresía (RF-6, RF-10, RF-13) → redirige a `/dashboard/calendar`, donde el calendario aparece visible al final de su propietario (RF-32, spec 002).
5. **ID y PIN.** El propietario activa el código con un rol y un PIN (RF-14 a RF-16) y puede cambiar el PIN o desactivarlo (RF-17, RF-18). La persona escribe ID y PIN en `/dashboard/join` → `join_with_code` aplica los límites y devuelve el estado (RF-19 a RF-23).
6. **Miembros.** Cualquier miembro abre `/members` y ve nombres y roles (RF-24). El propietario cambia el rol (RF-25) o expulsa (RF-26); los demás pueden salir (RF-27). El propietario recibe el mensaje de RF-28 si lo intenta sobre sí mismo. Al dejar de ser miembro, el trigger limpia sus preferencias (RF-31) y sus eventos permanecen (RF-30).
7. **Juntar calendarios con miembros.** La página carga los miembros con `calendar_members_with_names` y `merge-access` calcula quién pierde y quién gana (RF-36, RF-37). Tras confirmar, `merge_calendars` borra los calendarios origen y sus miembros caen en cascada (RF-38).

## Decisiones técnicas

- D1: Unirse con **funciones `SECURITY DEFINER`** que insertan en `calendar_members`; el INSERT directo sigue sin política. Descartada una política de INSERT, porque RLS no puede comprobar un token ni un PIN. Cubre: RF-6, RF-9, RF-19.
- D2: **Token aleatorio de 256 bits** guardado como SHA-256 y mostrado una sola vez. Descartado guardarlo en claro (quien leyera la base de datos tendría acceso) y descartado bcrypt (innecesario con tanta entropía). Cubre: RF-1, RF-13 y el RNF de secretos.
- D3: **PIN con bcrypt** (`crypt` y `gen_salt('bf')` de `pgcrypto`). Descartado SHA-256, porque un PIN de 6 a 10 dígitos se recupera por diccionario si se filtra la base de datos. Cubre: RF-14, RF-16, RF-19.
- D4: `join_with_code` **devuelve un estado** y no lanza errores. Descartado lanzar una excepción, porque revertiría la transacción y el intento fallido no quedaría registrado, anulando el límite. Cubre: RF-20 a RF-22.
- D5: **Bloqueo por los N últimos fallos**: la persona se bloquea si sus 5 últimos fallos caben en 15 minutos y el último tiene menos de 15; un ID, con 20. Descartada una ventana fija por minuto, porque el bloqueo duraría menos de lo que dice la spec. Cubre: RF-21, RF-22.
- D6: **Políticas RLS más permiso por columna** para cambiar roles, expulsar y abandonar. Descartadas funciones RPC para esto, porque la base de datos ya impone el permiso (P3) y hay menos código que mantener. Cubre: RF-25 a RF-29.
- D7: **Nombres de miembros por RPC** (`calendar_members_with_names`). Descartado ampliar la política de `profiles` a los co-miembros, porque expondría la zona horaria (D9 de la spec 002). Cubre: RF-24, RF-36, RF-37.
- D8: **Vista previa por GET y unión por POST** (Server Action). Descartado unir al abrir el enlace, porque las previsualizaciones de mensajería gastarían los usos. Cubre: RF-5, RF-6.
- D9: **Ruta pública `/invite/[token]`** y `next` validado contra la forma `/invite/<token>`. Descartado aceptar cualquier `next` (redirección abierta). Cubre: RF-7.
- D10: **`next` leído en el cliente** (`useSearchParams` bajo `Suspense`). Descartado leer `searchParams` en la página, porque dejaría de prerenderizarse el login. Cubre: RF-7.
- D11: **Enlace absoluto construido con las cabeceras de la petición** (`x-forwarded-host` y `x-forwarded-proto`). Descartada una variable de entorno nueva, porque exige configuración en Vercel y la URL solo la ve quien la crea. Cubre: RF-1, RF-2.
- D12: **`Referrer-Policy: no-referrer` y `noindex` en `/invite/*`**. Descartado dejar las cabeceras por defecto, porque el token saldría en el `Referer` hacia otros sitios. Cubre: RNF de secretos.
- D13: **Un único mensaje** para toda invitación no válida y otro para ID o PIN incorrectos. Descartado distinguir motivos, porque permitiría saber si un enlace existió. Cubre: RF-8, RF-19.
- D14: **`merge_calendars` sin cambios** (la cascada ya retira a los miembros de los calendarios que desaparecen). Descartado reescribirla, porque el comportamiento ya es el pedido. Cubre: RF-36 a RF-38.
- D15: **Aviso de juntar calculado en el servidor** con una función pura sobre los miembros leídos por RPC. Descartado calcularlo en el cliente, porque tendría que recibir más datos de los necesarios. Cubre: RF-36, RF-37.
- D16: **ID de 8 caracteres de un alfabeto de 31** sin `I`, `L`, `O`, `0` ni `1`, con reintento si colisiona. Descartado el UUID, porque no se puede dictar ni teclear. Cubre: RF-14.
- D17: **Limpiar `join_attempts` de más de un día en cada intento**. Descartado un cron nuevo, porque el plan Hobby limita los crons y la tabla es pequeña. Cubre: RF-21, RF-22.
- D18: **Tras unirse se redirige a `/dashboard/calendar`**, donde el calendario aparece visible al final de su propietario. Descartado abrir una página propia por calendario, porque no existe en la spec 002. Cubre: RF-6, RF-19, RF-32.
- D19: **Extensión `pgcrypto` de Postgres** (viene con Supabase Free) y cero dependencias de npm. Descartado instalar una librería de hash en Node, porque los hashes se calculan dentro de las funciones SQL. Cubre: RF-1, RF-14. Se registra aquí por transparencia con P6.

## Trazabilidad RF -> módulo

| RF | Módulos |
|----|---------|
| RF-1 | `create_invite`, `sharing/schemas`, `createInvite`, `invite-form`, `invite-url` |
| RF-2 | `invite-url`, `copy-button`, `invite-form` |
| RF-3 | `sharing/schemas`, `create_invite` (comprobación), `invite-form` |
| RF-4 | `create_invite` (caducidad a 7 días) |
| RF-5 | `get_invite_preview`, `/invite/[token]`, `invite-join-card` |
| RF-6 | `accept_invite`, `acceptInvite`, `invite-join-card` |
| RF-7 | `route-access`, `proxy`, `next-path`, `next-field`, `(auth)/actions` |
| RF-8 | `get_invite_preview`, `accept_invite`, `sharing/error-messages`, `invite-join-card` |
| RF-9 | `get_invite_preview`, `accept_invite`, `invite-join-card` |
| RF-10 | `accept_invite` (contador de usos) |
| RF-11 | `calendar_invites` (lectura por propietario), `sharing/queries`, `invite-list` |
| RF-12 | `revoke_invite`, `revokeInvite`, `invite-list` |
| RF-13 | `accept_invite` (bloqueo de fila) |
| RF-14 | `set_access_code`, `saveAccessCode`, `access-code-panel`, `sharing/schemas` |
| RF-15 | `sharing/schemas`, `set_access_code` (comprobación), `access-code-panel` |
| RF-16 | `calendar_access_codes` (sin lectura de `pin_hash`), `access-code-panel` |
| RF-17 | `set_access_code`, `saveAccessCode` |
| RF-18 | `disable_access_code`, `set_access_code` (reactivación), `access-code-panel` |
| RF-19 | `join_with_code`, `joinWithCode`, `join-code-form` |
| RF-20 | `join_with_code` (normalización y estado `invalid`), `sharing/error-messages` |
| RF-21 | `join_with_code`, `join_attempts`, `sharing/error-messages` |
| RF-22 | `join_with_code`, `join_attempts`, `sharing/error-messages` |
| RF-23 | `join_with_code` (estado `member`), `joinWithCode` |
| RF-24 | `calendar_members_with_names`, `sharing/queries`, `member-list`, `/members` |
| RF-25 | políticas de `calendar_members`, `changeMemberRole`, `member-list` |
| RF-26 | políticas de `calendar_members`, `expelMember`, `member-list` |
| RF-27 | políticas de `calendar_members`, `leaveCalendar`, `member-list` |
| RF-28 | políticas de `calendar_members`, `sharing/error-messages`, `member-list` |
| RF-29 | RLS y funciones (comprobación de propietario), páginas `share` y `members` (404) |
| RF-30 | modelo existente (eventos y categorías no dependen de la membresía); test |
| RF-31 | trigger de limpieza de preferencias |
| RF-32 | agrupación y preferencias de la spec 002 (`grouping`); test |
| RF-33 | `calendar-list`, `/dashboard` |
| RF-34 | `calendar-list`, `/dashboard` |
| RF-35 | `/dashboard`, `/dashboard/join` |
| RF-36 | `calendar_members_with_names`, `merge-access`, `merge-form`, `/merge` |
| RF-37 | `merge-access`, `merge-form` |
| RF-38 | `merge_calendars` (sin cambios); test |

## Riesgos y mitigaciones

- R1: **Cambia un test de la spec 001.** `rls.test.ts` afirma que nadie modifica ni borra membresías, y ahora el propietario puede expulsar. Mitigación: se reescribe ese caso para reflejar el nuevo permiso (el INSERT directo sigue prohibido) y se añade la matriz completa de la 003.
- R2: **Funciones `SECURITY DEFINER` mal acotadas** podrían dar acceso. Mitigación: `search_path = ''`, nombres calificados, revocar a `anon` y `public`, comprobar el rol dentro de cada función y un test por función con Propietario, Editor, Lector, invitado y ajeno.
- R3: **Fuerza bruta del PIN elegido por el usuario** (puede ser `123456`). Mitigación: los límites por persona y por ID, bcrypt y la prueba de bloqueo con varias cuentas. Queda un riesgo residual aceptado en la spec: un PIN débil sigue siendo débil.
- R4: **Un tercero puede bloquear un ID** fallando a propósito. Mitigación: es el comportamiento pedido en RF-22; el propietario cambia el PIN y los enlaces no se ven afectados.
- R5: **`join_attempts` crece.** Mitigación: limpieza de más de un día en cada intento (D17) e índices.
- R6: **El portapapeles puede no estar disponible** en algunos navegadores. Mitigación: texto seleccionable como alternativa en `copy-button`.
- R7: **El proxy borra la query al redirigir** y perdería `next`. Mitigación: se cambia para conservarla solo en esta redirección, con test en `route-access` y en el proxy.
- R8: **Concurrencia en `accept_invite`.** Mitigación: bloqueo de fila y un test con dos personas compitiendo por un único uso.
- R9: **`test:db` es intermitente** (conocido) y la prueba de 20 fallos necesita varias cuentas. Mitigación: repetir antes de investigar y reutilizar usuarios de prueba.
- R10: **`pgcrypto` o su esquema podrían diferir** entre `dev` y `prod`. Mitigación: `create extension if not exists` en la migración y una comprobación manual en `dev` antes de aplicar en prod.
- R11: **Páginas con `params` y `searchParams` con `cacheComponents`.** Mitigación: seguir el patrón de la spec 002 (componente `async` bajo `Suspense`).

## Dudas abiertas

- Ninguna pendiente. Las decisiones técnicas que la spec no fijaba (D8 a D12, D17 y D18) quedan aprobadas junto con este plan.
