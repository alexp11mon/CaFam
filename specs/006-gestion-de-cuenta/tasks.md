# Tasks 006 - Gestión de cuenta

> Estado: **Pendientes de aprobación** por el usuario. Primera iteración: T1 a T12 (base de datos, avisos, plazo y recuperación de contraseña). La segunda iteración (Ajustes: perfil, email, contraseña, borrado y avisos en pantalla) se redacta después de aprobar esta.
> Spec: `specs/006-gestion-de-cuenta/spec.md`. Plan: `specs/006-gestion-de-cuenta/plan.md`.
> Reglas: una tarea cada vez, test primero (rojo → verde). Al cerrar cada tarea se ejecuta y reporta `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, y `npm run test:db -- <filtro>` si toca esquema, RLS o acceso a datos. Si toca interfaz, capturas a 390, 768 y 1440 px (P9). Un commit por tarea citándola, en la rama `006-gestion-de-cuenta`.
> Sin dependencias nuevas (P6): ninguna tarea toca `package.json`. El proveedor SMTP es Brevo, registrado en la spec.
> Migraciones: solo nuevas en `supabase/migrations/`, con `npm run db:push` (dev) y `npm run db:types`. Producción la aplica el usuario con `npx supabase db push` tras enlazar prod, y vuelve a enlazar dev.

## Tareas

- [x] T1 Comprobar en dev las tres capacidades que el plan da por supuestas (R1, R2)
  Pasos: en el proyecto dev, con SQL de prueba y sin tocar el esquema: (a) una función `SECURITY DEFINER` con `search_path = ''` borra un `auth.users` de prueba creado para la comprobación; (b) `pg_cron`, `pg_net` y `vault` están disponibles y activos; (c) `vault.create_secret` guarda y `vault.decrypted_secrets` lee un valor de prueba. Se borran el usuario y el secreto de prueba al terminar. Los resultados se anotan en `plan.md` (R1 y R2).
  Hecho cuando: las tres comprobaciones dan el resultado esperado y `plan.md` anota la salida de cada una. Si (a) falla, se detiene la implementación y se vuelve a D1 con el usuario. Cubre: RF-19, RF-23, RF-26 | Módulo: account_orphan_schema (comprobación)

- [x] T2 Crear el esquema de cuenta: propietario anulable, avisos, decisiones, cola de correo y límite de recuperación
  Ajuste al cerrar: la comprobación de "un cambio de propietario dentro de la marca funciona" no se puede hacer desde los tests de cliente (no hay forma de activar la marca); pasa a los tests de T4, donde la función la activa. Los tipos de `calendars.owner_id` pasan a anulable en `queries.ts` y `grouping.ts`; los calendarios sin propietario no existen hasta T4 y su pantalla llega en la iteración 2 (no desplegar T4 a producción antes de esa pantalla).
  Pasos: test primero en `tests/integration/account-schema.test.ts`. Comprueba que:
  - `calendars.owner_id` admite nulo solo con `orphaned_at` fijado (el `check` rechaza el resto con `23514`);
  - un cambio de propietario fuera de la marca de transacción falla con `42501`, y dentro de ella funciona;
  - `calendar_orphan_decisions`, `account_notices` y `email_outbox` no admiten escritura desde `anon` ni `authenticated`; `account_notices` solo deja leer al propio usuario;
  - `auth_email_requests` no es legible por ningún cliente;
  - `list_tables_without_rls()` no devuelve tablas nuevas (test de P3 en verde).

  Migración `supabase/migrations/<timestamp>_account_orphan_schema.sql`.
  Hecho cuando: `npm run test:db -- account-schema schema rls` en verde y `src/types/database.ts` contiene `orphaned_at`, `account_notices` y `email_outbox`. Cubre: RF-21, RF-22, RF-23 | Módulo: account_orphan_schema

- [ ] T3 Limitar las peticiones de recuperación por cuenta con `request_recovery`
  Pasos: test primero en `tests/integration/account-recovery.test.ts`. Comprueba que:
  - `anon` puede llamar a la función y recibe `true` en las tres primeras peticiones de un mismo email en 15 minutos;
  - la cuarta devuelve `false`;
  - el email de un sitio distinto (mayúsculas, espacios) cuenta igual que el normalizado;
  - la tabla guarda solo el hash SHA-256, nunca el email;
  - pasados 15 minutos vuelve a aceptar.
  Función `request_recovery` en la migración de la tarea T2 o en una nueva si hace falta, `SECURITY DEFINER`, `search_path = ''`.
  Hecho cuando: `npm run test:db -- account-recovery` en verde. Cubre: RF-1, RF-5 | Módulo: account_functions

- [ ] T4 Borrar la cuenta conservando los calendarios compartidos con `delete_own_account`
  Pasos: test primero en `tests/integration/account-delete.test.ts` con tres usuarios A, B y C. Comprueba que, con A borrando su cuenta:
  - un calendario de A sin otros miembros desaparece con sus eventos, categorías y preferencias;
  - un calendario de A con B y C queda con `owner_id` nulo, `orphaned_at` fijado y sin cambios en sus eventos;
  - las filas de membresía de A desaparecen y sus eventos en calendarios ajenos quedan con `created_by` nulo;
  - B y C reciben un aviso `orphaned` que nombra a A y al calendario, y un correo en `email_outbox`;
  - `auth.users` ya no tiene a A, y una llamada sin sesión devuelve `42501`.

  Función `delete_own_account` (D1), con la marca de transacción de D2 para el cambio de propietario y el nombre visible guardado antes del borrado.
  Hecho cuando: `npm run test:db -- account-delete` en verde. Cubre: RF-18, RF-19, RF-20, RF-21, RF-23 | Módulo: account_functions

- [ ] T5 Conservar o salir de un calendario sin propietario con `decide_orphan_calendar`
  Pasos: test primero en `tests/integration/account-decide.test.ts`. Comprueba que:
  - un miembro puede registrar `keep = true` y luego cambiarlo a `false`;
  - con `keep = false` su membresía desaparece y el calendario sigue existiendo;
  - un calendario con propietario devuelve `CF404`;
  - un usuario que no es miembro devuelve `CF404`;
  - dos llamadas seguidas del mismo usuario dejan una sola decisión.
  Función `decide_orphan_calendar`, `SECURITY DEFINER` con comprobación de membresía y de estado.
  Hecho cuando: `npm run test:db -- account-decide` en verde. Cubre: RF-24, RF-25 | Módulo: account_functions

- [ ] T6 Copiar un calendario para cada miembro que lo conserva con `copy_calendar_for_owner`
  Pasos: test primero en `tests/integration/account-copy.test.ts`. Comprueba que:
  - la copia tiene el mismo nombre, color y descripción, y su propietario es el miembro indicado con fila `owner`;
  - las categorías se copian y cada evento conserva su categoría de la copia (mapa de ids);
  - los eventos conservan su `created_by` (o nulo si era de una cuenta borrada);
  - la copia no hereda invitaciones ni `calendar_access_codes`;
  - si falla a mitad, no queda nada a medias (la transacción se revierte).
  Función `copy_calendar_for_owner`, interna, sin acceso desde clientes.
  Hecho cuando: `npm run test:db -- account-copy` en verde. Cubre: RF-28, RF-20 | Módulo: account_functions

- [ ] T7 Aplicar la decisión de un calendario sin propietario con `apply_orphan_decisions`
  Pasos: test primero en `tests/integration/account-apply.test.ts`, con `orphaned_at` fijado en el pasado para simular el plazo. Comprueba que:
  - con dos miembros que conservan, cada uno recibe copia, el original desaparece y se crean dos avisos `kept_copy`;
  - con un único miembro que conserva, pasa a propietario sin copia (fila `owner`, `owner_id` fijado, `orphaned_at` a nulo);
  - sin nadie que conserve, el calendario se borra con todos sus eventos y se crea un aviso `deleted_calendar` por miembro;
  - un calendario con un miembro sin decidir y plazo sin vencer no se toca;
  - dos ejecuciones seguidas no duplican copias ni avisos (bloqueo `for update`).
  Función `apply_orphan_decisions`, solo ejecutable por `postgres`.
  Hecho cuando: `npm run test:db -- account-apply` en verde. Cubre: RF-26, RF-27, RF-28, RF-29 | Módulo: account_functions

- [ ] T8 Programar el plazo y la cola de correo con pg_cron y pg_net
  Pasos: test primero en `tests/integration/account-jobs.test.ts`. Comprueba que:
  - `cron.job` contiene los trabajos de `apply_orphan_decisions` (diario 03:00 UTC), `send_pending_emails` (cada 15 minutos) y la limpieza de `auth_email_requests` (diaria);
  - `send_pending_emails` marca `attempts` al fallar y no reintenta más de 5 veces;
  - con la clave de Vault ausente, la función falla sin borrar la cola.
  Migración `supabase/migrations/<timestamp>_account_mail_jobs.sql` y `send_pending_emails` con `net.http_post` a `https://api.brevo.com/v3/smtp/email`, cabecera `api-key` leída de Vault y correo en español.
  Hecho cuando: `npm run test:db -- account-jobs` en verde y, en dev, un correo de prueba llega a la bandeja del usuario. Cubre: RF-23, RF-26, RF-29 | Módulo: account_mail_jobs

- [ ] T9 Configurar Auth en dev: Brevo como SMTP, plantillas de recuperación y cambio de email, y notificación de cambio
  Pasos (los hace el usuario en el panel de dev, con las instrucciones entregadas en la conversación): SMTP propio con Brevo, plantillas con `token_hash` apuntando a `/auth/confirm`, Site URL, límite de correos ajustado, notificación de cambio de email activa. Después, se pide un enlace de recuperación de prueba y se confirma que llega.
  Hecho cuando: el usuario confirma que llega el correo de recuperación y el de cambio de email de prueba, con el enlace apuntando a `/auth/confirm`, y que el aviso al correo anterior aparece (o se anota como no disponible en R-plan, para la cola propia). Cubre: RF-1, RF-9 | Módulo: configuración de Auth (sin código)

- [ ] T10 Confirmar el enlace de Auth con `/auth/confirm`
  Pasos: tests primero en `tests/unit/account-confirm.test.ts` (route handler con `// @vitest-environment node` y Supabase mockeado): `token_hash` y `type` válidos llaman a `verifyOtp` y redirigen; un `type` distinto de `recovery` o `email_change` no llama a Auth; `next` fuera de `/reset-password` o `/dashboard/settings` vuelve a `/dashboard`; un token rechazado redirige a una página de enlace no válido. Ruta `src/app/auth/confirm/route.ts` y `src/lib/account/confirm-type.ts`. Añadir `/auth/confirm` a las rutas públicas de `route-access.ts` con su test.
  Hecho cuando: `npm test -- account-confirm route-access` en verde. Cubre: RF-2, RF-3, RF-11, RF-12 | Módulo: auth/confirm, confirm-type

- [ ] T11 Recuperar la contraseña desde la portada de acceso
  Pasos: tests primero en `tests/unit/forgot-password.test.tsx` y `tests/unit/reset-password.test.tsx` (Testing Library, textos en español). Comprueba que:
  - `/forgot-password` muestra el mismo mensaje tanto si el email existe como si no, y el enlace "¿Olvidaste tu contraseña?" aparece en `/login`;
  - `/reset-password` sin sesión redirige a `/login` (regla de `route-access`);
  - con sesión de recuperación, guardar una contraseña nueva llama a `updateUser` y después a `signOut({ scope: "others" })`;
  - un error de Auth se muestra con el texto de `error-messages`.
  Páginas `src/app/(auth)/forgot-password/page.tsx`, `src/app/(auth)/reset-password/page.tsx`, acciones `actions.ts` de cada una, y componentes `src/components/account/forgot-password-form.tsx` y `reset-password-form.tsx`. Capturas a 390, 768 y 1440 px con el acento rojo y amarillo (P9).
  Hecho cuando: `npm test -- forgot-password reset-password` en verde y el flujo completo se prueba en el navegador con `playwright-cli` en dev (pedir enlace, abrir el correo, cambiar contraseña, entrar con la nueva). Cubre: RF-1, RF-2, RF-4 | Módulo: forgot-password, reset-password, forgot-password-form, reset-password-form

- [ ] T12 Validar los datos de cuenta y los mensajes de error comunes
  Pasos: tests primero en `tests/unit/account-schemas.test.ts` y `tests/unit/account-error-messages.test.ts`. Comprueba que:
  - el nombre visible acepta de 1 a 50 caracteres y rechaza vacío y 51;
  - la contraseña nueva acepta de 8 a 72 caracteres con las reglas del registro, y rechaza igual a la actual (esto último lo recibe la acción, no el esquema);
  - el email nuevo se normaliza igual que en el registro;
  - los mensajes cubren: contraseña actual incorrecta, dirección ya usada, enlace caducado o usado, contraseña igual a la anterior, y un error de red que no revela si la cuenta existe.
  Archivos `src/lib/account/schemas.ts` y `src/lib/account/error-messages.ts`, reutilizando piezas de `src/lib/auth/`.
  Hecho cuando: `npm test -- account-schemas account-error-messages` en verde. Cubre: RF-7, RF-8, RF-12, RF-13, RF-15, RF-30, RF-31, RF-32 | Módulo: schemas, error-messages

## Trazabilidad RF -> Tareas

Iteración 1 (T1 a T12):
- RF-1 -> T3, T9, T11
- RF-2 -> T10, T11
- RF-3 -> T10
- RF-4 -> T11
- RF-5 -> T2, T3
- RF-7 -> T12
- RF-8 -> T12
- RF-9 -> T9
- RF-11 -> T10
- RF-12 -> T10, T12
- RF-13 -> T12
- RF-15 -> T12
- RF-18 -> T4
- RF-19 -> T1, T4
- RF-20 -> T4, T6
- RF-21 -> T2, T4
- RF-22 -> T2 (las políticas no cambian; la pantalla llega en la iteración 2)
- RF-23 -> T1, T2, T4, T8
- RF-24 -> T5 (la pantalla llega en la iteración 2)
- RF-25 -> T5 (la pantalla llega en la iteración 2)
- RF-26 -> T1, T7, T8
- RF-27 -> T7
- RF-28 -> T6, T7
- RF-29 -> T7, T8
- RF-30 -> T12 (esquema; la pantalla llega en la iteración 2)
- RF-31 -> T12 (mensajes; la pantalla llega en la iteración 2)
- RF-32 -> T12 (mensajes; la pantalla llega en la iteración 2)

Iteración 2 (pendiente de aprobar la primera): RF-6, RF-10 (email y pendiente en Ajustes), RF-14 (zona horaria), RF-16 y RF-17 (diálogo de borrado), RF-22 (aviso de sin propietario en miembros), RF-24 y RF-25 (pantalla de decisión), RF-33 (cierre de sesiones al cambiar contraseña en Ajustes).

## Dudas abiertas
- [NECESITA ACLARACIÓN: T1 (a) depende de que Postgres pueda borrar `auth.users` desde una función. Si no se puede, D1 se revisa con el usuario antes de T4.]
- [NECESITA ACLARACIÓN: T9 depende de que la notificación de cambio de email de Auth esté disponible en este proyecto. Si no, el aviso al correo anterior sale por la cola propia (D4) y se añade a T8.]
