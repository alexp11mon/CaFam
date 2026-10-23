# Plan 006 — Gestión de cuenta

> Nota (2026-10-23): se añaden RF-34 a RF-36 (autor del evento) por petición del usuario; solo afectan al detalle del evento, sin tablas ni funciones nuevas.
> Spec de origen: `specs/006-gestion-de-cuenta/spec.md` (aprobada, 2026-10-22). Constitución: `docs/constitution.md`. Estado: **Aprobado** por el usuario (2026-10-22), con Brevo como proveedor SMTP registrado en la spec. Spec **cerrada** el 2026-10-23.

## Resumen de arquitectura

La cuenta se gestiona con el propio Supabase Auth (recuperación, cambio de contraseña y de email) más funciones SQL `SECURITY DEFINER` para lo que Auth no hace: borrar la cuenta conservando los calendarios compartidos, aplicar el plazo de 15 días y avisar a los miembros. El plazo y los avisos corren dentro de Postgres (pg_cron y pg_net), así que no hace falta ninguna clave secreta en Vercel ni ningún servicio nuevo en la aplicación. El correo de Auth y el correo de aviso salen por el mismo proveedor SMTP gratuito. La interfaz son páginas bajo `/dashboard/settings`, una página pública de recuperación y la sección de calendarios sin propietario en `/dashboard/calendars`. Sin dependencias nuevas de npm.

```
Visitante  ── /forgot-password ──▶ rpc request_recovery (límite por cuenta) ──▶ Auth envía enlace
           ── /auth/confirm?token_hash&type ──▶ verifyOtp ──▶ /reset-password ──▶ updateUser + signOut(others)
Usuario    ── /dashboard/settings ──▶ perfil (RLS propio) · email (Auth, pendiente) · contraseña (verifica y cambia) · borrar cuenta
                                    └─ rpc delete_own_account ──▶ calendarios sin propietario + avisos + delete auth.users
Miembro    ── /dashboard/calendars ──▶ avisos (account_notices) · rpc decide_orphan_calendar (conservar / salir)
Postgres   ── pg_cron diario ──▶ apply_orphan_decisions (copia, traspaso o borrado)
           ── pg_cron cada 15 min ──▶ send_pending_emails (pg_net → API HTTP del proveedor, clave en Vault)
```

## Módulos y responsabilidades

### SQL: migraciones nuevas (nunca se editan las aplicadas)

- `account_orphan_schema`: deja `calendars.owner_id` anulable, añade `calendars.orphaned_at` con un `check` (propietario nulo si y solo si hay fecha de abandono), crea las tablas de la sección de datos y actualiza `prevent_owner_change` para que solo cambie el propietario dentro de las funciones de cuenta. Activa las extensiones `pg_cron`, `pg_net` y `vault` si no lo están. Cubre: RF-21, RF-22, RF-23, RF-5.
- `account_functions`: `request_recovery`, `delete_own_account`, `decide_orphan_calendar`, `apply_orphan_decisions` y `copy_calendar_for_owner`. Cubre: RF-1, RF-5, RF-16 (solo la parte SQL), RF-18 a RF-21, RF-23 a RF-29.
- `account_mail_jobs`: `send_pending_emails`, `purge_account_maintenance` y la programación de los trabajos con `cron.schedule`. Cubre: RF-23, RF-26, RF-29.

No cambian: las políticas de `calendar_members`, `events` y `calendars` (RF-22 se verifica con un test, no con cambios). `merge_calendars` y `import_calendar` no se tocan.

### Lógica pura (`src/lib/account/`)

- `schemas.ts`: esquemas `zod` del nombre visible (1 a 50), de la zona horaria (reutiliza la de la spec 001) y de la contraseña nueva (8 a 72, reutiliza `signUpSchema`). Cubre: RF-2, RF-13, RF-15, RF-30.
- `error-messages.ts`: traduce los errores de Auth a los mensajes de la spec (contraseña incorrecta, igual a la actual, email ya usado, enlace caducado o usado). No decide permisos. Cubre: RF-3, RF-7, RF-8, RF-12, RF-31, RF-32.
- `confirm-type.ts`: acepta solo los tipos `recovery` y `email_change` y el destino `next` válido. Cubre: RF-2, RF-11.

### Server Actions y rutas

- `src/app/(auth)/forgot-password/actions.ts` (`requestRecovery`): llama a `request_recovery`; si Auth envía el enlace, o si el límite está activo, devuelve el mismo mensaje. Cubre: RF-1, RF-5.
- `src/app/auth/confirm/route.ts`: Route Handler que llama a `verifyOtp` con `token_hash` y el tipo, deja la sesión en cookies y redirige a `/reset-password` (recuperación) o a `/dashboard/settings` (cambio de email). Si falla, muestra el aviso de enlace no válido. Cubre: RF-2, RF-3, RF-11, RF-12.
- `src/app/(auth)/reset-password/actions.ts` (`resetPassword`): `updateUser({ password })` y luego `signOut({ scope: "others" })`. Cubre: RF-2, RF-4.
- `src/app/dashboard/settings/account-actions.ts`: `saveProfile`, `requestEmailChange`, `changePassword`, `deleteAccount`. Cada una valida con `zod`, verifica la contraseña actual con `signInWithPassword` cuando hace falta (RF-7, RF-16, RF-31) y llama a `revalidatePath("/dashboard", "layout")`. Cubre: RF-6 a RF-8, RF-13 a RF-17, RF-30 a RF-33.
- `src/app/dashboard/calendars/orphan-actions.ts`: `decideOrphanCalendar(calendarId, keep)` y `dismissNotice(id)`. Cubre: RF-24, RF-25, RF-23 (lectura de avisos).

### Páginas y componentes

- `/forgot-password` (pública): formulario de email y mensaje único. Enlace "¿Olvidaste tu contraseña?" en `/login`. Cubre: RF-1.
- `/reset-password` (requiere sesión de recuperación; sin sesión → `/login`): formulario de contraseña nueva. Cubre: RF-2, RF-4.
- `/dashboard/settings` (modificada): cuatro secciones con el mismo patrón que el acento (`Suspense` por sección). Cubre: RF-6, RF-10, RF-13 a RF-17, RF-30 a RF-33.
- `/dashboard/calendars` (modificada): bloque "Avisos" y calendarios sin propietario con los botones Conservar y Salir. Cubre: RF-23, RF-24, RF-25.
- Grupo "Sin propietario" (añadido en T26): `groupByPerson` pone los calendarios sin propietario en un último grupo con id `orphan`, que no se reordena ni se guarda en `person_preferences` (clave a perfiles); su visibilidad se guarda calendario a calendario. Cubre: RF-22.
- `/dashboard/calendars/[id]/members` (modificada): indica "Sin propietario, plazo hasta …" y oculta los controles de rol. Cubre: RF-22, RF-24.
- `/dashboard/events/[id]` (modificada) y `event-detail`: muestran "Creado por <nombre>" con el nombre de `calendar_members_with_names`, "Cuenta borrada" cuando `created_by` es nulo y "un antiguo miembro" cuando el autor ya no está en el calendario. La decisión de qué texto va con cada caso es una función pura, `lib/account/author-label.ts`. Cubre: RF-34, RF-35, RF-36.
- Componentes en `src/components/account/`: `profile-form`, `email-form` (con el aviso de cambio pendiente), `password-form`, `delete-account-dialog` (reutiliza `ConfirmDialog`), `forgot-password-form`, `reset-password-form`, `orphan-calendar-item` y `notice-list`. Cubren: RF-1, RF-2, RF-6, RF-10, RF-13, RF-16, RF-23, RF-24, RF-30.

No hacen: no envían correo desde la aplicación; el correo de aviso sale siempre desde Postgres, y el de Auth desde su propio flujo.

## Modelo de datos

Todas las tablas nuevas con RLS activado, `created_at` y las convenciones de la constitución.

- Cambios en `calendars`: `owner_id` pasa a anulable; nueva columna `orphaned_at timestamptz null`; `check ((owner_id is null) = (orphaned_at is not null))`. El FK sigue con `on delete cascade`: al borrar el perfil, los calendarios con propietario se borran, y los que ya no tienen propietario no se ven afectados.
- `calendar_orphan_decisions { calendar_id → calendars on delete cascade, user_id → profiles on delete cascade, keep boolean, decided_at, pk (calendar_id, user_id) }`. Lectura propia; escritura solo por `decide_orphan_calendar`.
- `account_notices { id uuid pk, user_id → profiles on delete cascade, kind text (orphaned | kept_copy | deleted_calendar), person_name text, calendar_name text, created_at, read_at null }`. Lectura y marcado de lectura propios; escritura solo por funciones.
- `email_outbox { id bigint identity pk, to_email text, subject text, body text, created_at, sent_at null, attempts int default 0 }`. RLS activado sin políticas: solo lo leen y escriben funciones y el trabajo programado. Contiene correos de otras personas, así que nunca se expone a la API pública.
- `auth_email_requests { email_hash bytea, created_at }` con índice por `(email_hash, created_at desc)`. RLS activado sin políticas; guarda solo el SHA-256 del email normalizado.
- Secreto `brevo_api_key` (nombre provisional) en `vault.secrets`, creado por el usuario en el panel. No aparece en el repositorio.

## Contratos e interfaces

- `request_recovery(p_email text) returns boolean` (anon y authenticated): normaliza el email, cuenta las peticiones de su hash en 15 minutos, inserta la suya y devuelve `false` si supera 3. La aplicación muestra siempre el mismo mensaje (RF-1).
- `delete_own_account() returns void` (authenticated, `SECURITY DEFINER`, `search_path = ''`): por cada calendario propio con otros miembros, activa la marca de transacción, pone `owner_id` a nulo, fija `orphaned_at = now()`, crea un aviso `orphaned` por miembro y encola el correo; después guarda el nombre visible, borra `auth.users` del llamante (en cascada se borran el perfil, sus membresías, preferencias y calendarios sin otros miembros). Errores: `42501` si no hay sesión.
- `decide_orphan_calendar(p_calendar_id uuid, p_keep boolean) returns void` (authenticated): exige que el llamante sea miembro y que el calendario esté sin propietario; con `keep = false` borra su membresía (RF-25); guarda la decisión. Si ya decidió, la actualiza. Error `CF404` si el calendario ya no es un calendario sin propietario del llamante.
- `apply_orphan_decisions() returns void` (solo `postgres`, lo ejecuta pg_cron): para cada calendario sin propietario bloqueado con `for update`, si todos sus miembros han decidido o han pasado 15 días desde `orphaned_at`, aplica RF-27 a RF-29 y encola los avisos.
- `copy_calendar_for_owner(p_calendar_id uuid, p_user_id uuid) returns uuid` (interna): crea un calendario con el mismo nombre, color y descripción, categorías (con mapa de ids antiguos a nuevos) y eventos con sus campos y `created_by` originales; el propietario de la copia es `p_user_id` y su fila de membresía es `owner`.
- `send_pending_emails()` (solo `postgres`): toma hasta 50 filas de `email_outbox` con `sent_at is null` y envía cada una con `net.http_post` a la API HTTP del proveedor, con la clave leída de Vault; marca `sent_at` y suma intentos. Tras 5 intentos, deja de reintentar.
- Trabajos programados: `apply_orphan_decisions` diario a las 03:00 UTC; `send_pending_emails` cada 15 minutos; limpieza de `auth_email_requests` de más de un día, diaria.
- Auth (sin código propio): `resetPasswordForEmail`, `verifyOtp({ type, token_hash })`, `updateUser({ email })`, `updateUser({ password })`, `signInWithPassword` (verificación), `signOut({ scope })`.

## Flujo principal paso a paso

Caso central: un propietario borra su cuenta y un calendario compartido con dos personas pasa a decidirse.

1. El usuario confirma en el diálogo con su contraseña y su email (RF-16). La acción comprueba ambos con `signInWithPassword`; si fallan, no se borra nada (RF-17).
2. La acción llama a `delete_own_account` (RF-18 a RF-21). El calendario compartido queda con `owner_id` nulo y `orphaned_at` fijado; los calendarios sin otros miembros se borran en cascada.
3. Se crean los avisos `orphaned` y los correos en `email_outbox` (RF-23). La acción cierra la sesión local y redirige a `/login`.
4. Cada miembro ve el aviso en `/dashboard/calendars`. Elige Conservar (`decide_orphan_calendar(id, true)`, RF-24) o Salir (RF-25).
5. A las 03:00 UTC, `apply_orphan_decisions` mira el calendario. Si los dos han decidido, con dos conservar: copia para cada uno (RF-28), borra el original, avisa a los dos (`kept_copy`) y encola sus correos. Con uno: le traspasa la propiedad sin copia (RF-27). Con ninguno: lo borra y avisa (RF-29).
6. Cada 15 minutos, `send_pending_emails` envía los correos encolados (RF-23, RF-26, RF-29).

## Decisiones técnicas

- D1: Borrar la cuenta con una función SQL `SECURITY DEFINER` que hace `delete from auth.users where id = auth.uid()`. Descartado: una Edge Function o una ruta del servidor con la clave secreta, porque P4 y `AGENTS.md` prohíben esa clave fuera de `.env.test.local`. Motivo: sin claves nuevas y sin servicio paralelo. Riesgo verificado en la primera tarea (R1). Cubre: RF-19, RF-16.
- D2: Propietario anulable con `orphaned_at` y marca de transacción para el cambio de propietario. Descartado: una tabla de propiedad separada, que duplicaría la fuente de verdad de los permisos. Motivo: las políticas RLS ya leen `owner_id` y `calendar_members`. Cubre: RF-21, RF-22, RF-27.
- D3: El plazo y las decisiones se aplican en Postgres con pg_cron. Descartado: el cron de Vercel (necesitaría privilegios de servicio en la aplicación) y aplicar el plazo al entrar el usuario (no garantiza el aviso ni el plazo si nadie entra). Motivo: cumple el plazo aunque nadie entre. Cubre: RF-26 a RF-29.
- D4: Los correos de aviso salen de Postgres con pg_net a la API HTTP de Brevo (`https://api.brevo.com/v3/smtp/email`, cabecera `api-key`), con la clave en Vault. Brevo: plan gratuito de 300 correos al día, sin tarjeta, con API y SMTP incluidos; la cuenta debe aprobarse antes del primer envío (fuente: Brevo, "Free SMTP Server" y "Pricing Plans", consultadas el 2026-10-22; los límites se comprueban en su web antes de activarlo). Descartado: una librería SMTP (dependencia no aprobada, P6) y el envío desde Vercel (clave fuera de la aplicación). Motivo: sin dependencias ni claves en el código. Cubre: RF-23, RF-26, RF-29.
- D5: Recuperación y cambio de email con el correo de Auth (plantillas del panel), usando el SMTP gratuito configurado en Supabase. Descartado: el envío por defecto de Supabase (límite muy bajo y remitente de Supabase, decidido en la spec). Motivo: usa el mismo proveedor que el correo de aviso. Cubre: RF-1, RF-9, RF-10.
- D6: Límite de 3 recuperaciones cada 15 minutos por cuenta, con tabla de hashes y una función pública. Descartado: el límite global por hora de Auth, que no es por cuenta. Motivo: RF-5 pide por cuenta. Cubre: RF-5.
- D7: Cambio de contraseña verificando la actual con `signInWithPassword`, después `updateUser` y `signOut({ scope: "others" })`. Descartado: `secure_password_change` (exige reautenticar por correo) y pedir la contraseña sin verificarla. Motivo: sin correo extra y con la verificación que pide RF-31. Riesgo: `signInWithPassword` reemplaza las cookies de la sesión actual (R3). Cubre: RF-30 a RF-33.
- D8: Enlaces de Auth con `token_hash` por `/auth/confirm` (Route Handler, `verifyOtp`). Descartado: el enlace directo de Auth, que no deja controlar el destino ni los errores. Motivo: el mismo flujo para recuperación y cambio de email. Cubre: RF-2, RF-3, RF-11, RF-12.
- D9: Las copias se hacen en una sola transacción, con el mapa de categorías. Descartado: copiar desde la aplicación, que no sería atómica. Motivo: un fallo a mitad no deja copias a medias. Cubre: RF-28.
- D10: Avisos en una tabla propia con RLS de lectura propia. Descartado: avisos en memoria o en el perfil. Motivo: deben sobrevivir a un cierre de sesión. Cubre: RF-23.

## Trazabilidad RF -> módulo

- RF-1 -> `forgot-password/actions`, `request_recovery`, `forgot-password-form`
- RF-2 -> `auth/confirm`, `reset-password/actions`, `confirm-type`, `reset-password-form`, `schemas`
- RF-3 -> `auth/confirm`, `error-messages`
- RF-4 -> `reset-password/actions`
- RF-5 -> `request_recovery`, `account_orphan_schema` (tabla `auth_email_requests`), `account_mail_jobs` (limpieza)
- RF-6 -> `email-form`, `account-actions`
- RF-7 -> `account-actions`, `error-messages`
- RF-8 -> `account-actions`, `error-messages`
- RF-9 -> `account-actions` (Auth), plantillas y notificación del panel (ver Dudas)
- RF-10 -> `email-form` (lee el email pendiente de la sesión)
- RF-11 -> `auth/confirm`, `confirm-type`
- RF-12 -> `auth/confirm`, `error-messages`
- RF-13 -> `profile-form`, `account-actions`, `schemas`
- RF-14 -> `profile-form`, `account-actions` (la zona la valida el trigger existente)
- RF-15 -> `schemas`, `account-actions`
- RF-16 -> `delete-account-dialog`, `account-actions`
- RF-17 -> `account-actions`
- RF-18 -> `delete_own_account`
- RF-19 -> `delete_own_account` (D1), `account-actions` (cierre de sesión local)
- RF-20 -> `delete_own_account` (cascada y `created_by` a nulo)
- RF-21 -> `delete_own_account`, `account_orphan_schema`
- RF-22 -> `account_orphan_schema` (políticas sin cambios), `members` page
- RF-23 -> `delete_own_account`, `account_notices`, `email_outbox`, `notice-list`
- RF-24 -> `decide_orphan_calendar`, `orphan-actions`, `orphan-calendar-item`
- RF-25 -> `decide_orphan_calendar`, `orphan-actions`
- RF-26 -> `apply_orphan_decisions`, `account_mail_jobs` (programación)
- RF-27 -> `apply_orphan_decisions`
- RF-28 -> `copy_calendar_for_owner`, `apply_orphan_decisions`
- RF-29 -> `apply_orphan_decisions`, `send_pending_emails`
- RF-30 -> `password-form`, `account-actions`, `schemas`
- RF-31 -> `account-actions`, `error-messages`
- RF-32 -> `account-actions`, `error-messages`
- RF-33 -> `account-actions` (`signOut({ scope: "others" })`)
- RF-34 -> `event-detail`, `author-label`
- RF-35 -> `event-detail`, `author-label`, `delete_own_account` (deja `created_by` a nulo)
- RF-36 -> `event-detail`, `author-label`

Requisitos no funcionales: NF-1 y NF-2 -> `error-messages` (mismo texto para cualquier email) y D4 (ninguna clave en código); NF-3 y NF-4 -> componentes de `src/components/account/` con tokens y revisión visual; NF-5 -> sin dependencias nuevas (verificado por `package.json`).

## Riesgos y mitigaciones

- R1: `delete from auth.users` desde una función puede no estar permitido en el proyecto. **Comprobado en dev (T1, 2026-10-22): sí.** Una función `SECURITY DEFINER` con sesión `authenticated` borró el usuario de prueba (1 fila), su perfil cayó en cascada y no quedó ninguna fila ni la función de prueba. D1 se mantiene.
- R2: `pg_cron`, `pg_net` o `vault` pueden no estar disponibles en el plan gratuito. **Comprobado en dev (T1, 2026-10-22):** `supabase_vault` 0.3.1 instalado; `pg_cron` 1.6.4 y `pg_net` 0.20.4 disponibles pero aún no instalados, se activan en la migración de T8. Vault guarda, descifra y borra un valor de prueba correctamente. D3 y D4 se mantienen.
- R3: `signInWithPassword` en la comprobación de la contraseña sustituye las cookies de la sesión actual. Mitigación: prueba de navegador tras el cambio (sigue dentro, las otras sesiones se cierran).
- R4: Un token de acceso ya emitido sigue válido hasta caducar aunque la cuenta se borre (`getClaims` no consulta la base de datos). Mitigación: el borrado elimina las filas que dan acceso a datos y las inserciones fallan por la clave foránea; se documenta el plazo de caducidad del token.
- R5: Dos miembros decidiendo a la vez mientras corre el trabajo. Mitigación: `for update` sobre el calendario en `apply_orphan_decisions` y `decide_orphan_calendar`.
- R6: Las copias pueden superar el límite de 50 calendarios por persona. Mitigación: se permite igualmente (decisión del usuario); el límite no se aplica a las copias.
- R7: El límite diario de Brevo (300 correos al día en el plan gratuito) puede bloquear avisos en un día con muchos. Mitigación: la cola reintenta hasta 5 veces y los avisos siguen en la app; el aviso de la app no depende del correo.
- R8: En las copias, los eventos de una cuenta borrada tienen `created_by` nulo. Mitigación: la interfaz muestra "Cuenta borrada" cuando el autor es nulo (RF-20 y RF-28). Hoy la interfaz no muestra el autor de los eventos; la regla se aplica en cuanto se muestre.

## Dudas abiertas

## Dudas resueltas (2026-10-22)

- Proveedor SMTP: Brevo (D4 y D5), registrado en la spec (P6).
- Copias por encima de 50 calendarios: se hacen igualmente (R6).
- Autor en copias y eventos de cuentas borradas: "Cuenta borrada" (RF-20, R8).
- Configuración de plantillas, SMTP y notificaciones en el panel de Supabase: paso manual del usuario, con las instrucciones que se entregan aparte.

## Dudas abiertas

- [NECESITA ACLARACIÓN: el aviso de cambio de email al correo anterior (RF-9) depende de la notificación de cambio de email de Auth. Verificar en dev antes de la tarea; si no está disponible, el aviso sale por la cola propia (D4).]
