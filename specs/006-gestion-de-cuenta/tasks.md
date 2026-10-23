# Tasks 006 - Gestión de cuenta

> Estado: primera iteración (T1 a T12) **aprobada**: T1 a T8, T10 y T12 hechas; T9 y T11 abiertas (ver sus notas). Segunda iteración (T13 a T25: Ajustes, avisos, calendarios sin propietario y autor del evento) **aprobada** por el usuario (2026-10-23), sin ninguna hecha todavía.
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

- [x] T3 Limitar las peticiones de recuperación por cuenta con `request_recovery`
  Pasos: test primero en `tests/integration/account-recovery.test.ts`. Comprueba que:
  - `anon` puede llamar a la función y recibe `true` en las tres primeras peticiones de un mismo email en 15 minutos;
  - la cuarta devuelve `false`;
  - el email de un sitio distinto (mayúsculas, espacios) cuenta igual que el normalizado;
  - la tabla guarda solo el hash SHA-256, nunca el email;
  - pasados 15 minutos vuelve a aceptar.
  Función `request_recovery` en la migración de la tarea T2 o en una nueva si hace falta, `SECURITY DEFINER`, `search_path = ''`.
  Hecho cuando: `npm run test:db -- account-recovery` en verde. Cubre: RF-1, RF-5 | Módulo: account_functions

- [x] T4 Borrar la cuenta conservando los calendarios compartidos con `delete_own_account`
  Pasos: test primero en `tests/integration/account-delete.test.ts` con tres usuarios A, B y C. Comprueba que, con A borrando su cuenta:
  - un calendario de A sin otros miembros desaparece con sus eventos, categorías y preferencias;
  - un calendario de A con B y C queda con `owner_id` nulo, `orphaned_at` fijado y sin cambios en sus eventos;
  - las filas de membresía de A desaparecen y sus eventos en calendarios ajenos quedan con `created_by` nulo;
  - B y C reciben un aviso `orphaned` que nombra a A y al calendario, y un correo en `email_outbox`;
  - `auth.users` ya no tiene a A, y una llamada sin sesión devuelve `42501`.

  Función `delete_own_account` (D1), con la marca de transacción de D2 para el cambio de propietario y el nombre visible guardado antes del borrado.
  Hecho cuando: `npm run test:db -- account-delete` en verde. Cubre: RF-18, RF-19, RF-20, RF-21, RF-23 | Módulo: account_functions

- [x] T5 Conservar o salir de un calendario sin propietario con `decide_orphan_calendar`
  Pasos: test primero en `tests/integration/account-decide.test.ts`. Comprueba que:
  - un miembro puede registrar `keep = true` y luego cambiarlo a `false`;
  - con `keep = false` su membresía desaparece y el calendario sigue existiendo;
  - un calendario con propietario devuelve `CF404`;
  - un usuario que no es miembro devuelve `CF404`;
  - dos llamadas seguidas del mismo usuario dejan una sola decisión.
  Función `decide_orphan_calendar`, `SECURITY DEFINER` con comprobación de membresía y de estado.
  Hecho cuando: `npm run test:db -- account-decide` en verde. Cubre: RF-24, RF-25 | Módulo: account_functions

- [x] T6 Copiar un calendario para cada miembro que lo conserva con `copy_calendar_for_owner`
  Pasos: test primero en `tests/integration/account-copy.test.ts`. Comprueba que:
  - la copia tiene el mismo nombre, color y descripción, y su propietario es el miembro indicado con fila `owner`;
  - las categorías se copian y cada evento conserva su categoría de la copia (mapa de ids);
  - los eventos conservan su `created_by` (o nulo si era de una cuenta borrada);
  - la copia no hereda invitaciones ni `calendar_access_codes`;
  - si falla a mitad, no queda nada a medias (la transacción se revierte).
  Función `copy_calendar_for_owner`, interna, sin acceso desde clientes.
  Hecho cuando: `npm run test:db -- account-copy` en verde. Cubre: RF-28, RF-20 | Módulo: account_functions

- [x] T7 Aplicar la decisión de un calendario sin propietario con `apply_orphan_decisions`
  Pasos: test primero en `tests/integration/account-apply.test.ts`, con `orphaned_at` fijado en el pasado para simular el plazo. Comprueba que:
  - con dos miembros que conservan, cada uno recibe copia, el original desaparece y se crean dos avisos `kept_copy`;
  - con un único miembro que conserva, pasa a propietario sin copia (fila `owner`, `owner_id` fijado, `orphaned_at` a nulo);
  - sin nadie que conserve, el calendario se borra con todos sus eventos y se crea un aviso `deleted_calendar` por miembro;
  - un calendario con un miembro sin decidir y plazo sin vencer no se toca;
  - dos ejecuciones seguidas no duplican copias ni avisos (bloqueo `for update`).
  Función `apply_orphan_decisions`, solo ejecutable por `postgres`.
  Hecho cuando: `npm run test:db -- account-apply` en verde. Cubre: RF-26, RF-27, RF-28, RF-29 | Módulo: account_functions

- [x] T8 Programar el plazo y la cola de correo con pg_cron y pg_net
  Pasos: test primero en `tests/integration/account-jobs.test.ts`. Comprueba que:
  - `cron.job` contiene los trabajos de `apply_orphan_decisions` (diario 03:00 UTC), `send_pending_emails` (cada 15 minutos) y la limpieza de `auth_email_requests` (diaria);
  - `send_pending_emails` marca `attempts` al fallar y no reintenta más de 5 veces;
  - con la clave de Vault ausente, la función falla sin borrar la cola.
  Migración `supabase/migrations/<timestamp>_account_mail_jobs.sql` y `send_pending_emails` con `net.http_post` a `https://api.brevo.com/v3/smtp/email`, cabecera `api-key` leída de Vault y correo en español.
  Hecho cuando: `npm run test:db -- account-jobs` en verde y, en dev, un correo de prueba llega a la bandeja del usuario. Cubre: RF-23, RF-26, RF-29 | Módulo: account_mail_jobs
  Hecha (2026-10-22). Prueba de entrega real: correo de prueba recibido en la bandeja, tras configurar el secreto brevo_api_key en Vault y desactivar la restricción de IP en Brevo (la primera llamada dio 401 por IP no autorizada).

- [ ] T9 Configurar Auth en dev: Brevo como SMTP, plantillas de recuperación y cambio de email, y notificación de cambio
  Pasos (los hace el usuario en el panel de dev, con las instrucciones entregadas en la conversación): SMTP propio con Brevo, plantillas con `token_hash` apuntando a `/auth/confirm`, Site URL, límite de correos ajustado, notificación de cambio de email activa. Después, se pide un enlace de recuperación de prueba y se confirma que llega.
  Hecho cuando: el usuario confirma que llega el correo de recuperación y el de cambio de email de prueba, con el enlace apuntando a `/auth/confirm`, y que el aviso al correo anterior aparece (o se anota como no disponible en R-plan, para la cola propia). Cubre: RF-1, RF-9 | Módulo: configuración de Auth (sin código)
  Estado (2026-10-23): parcial. SMTP de Brevo y plantillas configurados en dev. Auth acepta el envío de recuperación (tras corregir credenciales SMTP y la restricción de IP). Brevo registra el correo como "Cargado por proxy" pero no se ha confirmado la llegada a la bandeja. El correo de cambio de email no se puede disparar hasta la iteración 2 (pantalla de Ajustes). T9 sigue abierta.

- [x] T10 Confirmar el enlace de Auth con `/auth/confirm`
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
  Estado (2026-10-23): la prueba en navegador de recuperación no está completa: el correo no se ha confirmado en la bandeja. Pendiente.
  Estado: tests unitarios (action, formularios, enlace en login, acceso) en verde y build correcto. Pendiente: el flujo completo en navegador con playwright-cli en dev (necesita T9: correos de Auth) y las capturas a 390, 768 y 1440 px. T11 no se marca como hecha hasta entonces.

- [x] T12 Validar los datos de cuenta y los mensajes de error comunes
  Pasos: tests primero en `tests/unit/account-schemas.test.ts` y `tests/unit/account-error-messages.test.ts`. Comprueba que:
  - el nombre visible acepta de 1 a 50 caracteres y rechaza vacío y 51;
  - la contraseña nueva acepta de 8 a 72 caracteres con las reglas del registro, y rechaza igual a la actual (esto último lo recibe la acción, no el esquema);
  - el email nuevo se normaliza igual que en el registro;
  - los mensajes cubren: contraseña actual incorrecta, dirección ya usada, enlace caducado o usado, contraseña igual a la anterior, y un error de red que no revela si la cuenta existe.
  Archivos `src/lib/account/schemas.ts` y `src/lib/account/error-messages.ts`, reutilizando piezas de `src/lib/auth/`.
  Hecho cuando: `npm test -- account-schemas account-error-messages` en verde. Cubre: RF-7, RF-8, RF-12, RF-13, RF-15, RF-30, RF-31, RF-32 | Módulo: schemas, error-messages

## Iteración 2: Ajustes, avisos y calendarios sin propietario (T13 a T25)

> Estado: **Aprobadas** por el usuario (2026-10-23). Se implementan de una en una, con el test primero y la misma verificación que la iteración 1. No se despliega T4 a producción antes de T21 (pantalla de calendarios sin propietario). Las acciones de este bloque llevan un test de servidor (`// @vitest-environment node`, Supabase mockeado) y, las pantallas, un test de componente y capturas a 390, 768 y 1440 px con el acento rojo y el amarillo (P9).

- [x] T13 Guardar el perfil y cambiar la contraseña con `saveProfile` y `changePassword`
  Pasos: tests primero en `tests/unit/account-profile-password-actions.test.ts`. Comprueba que:
  - `saveProfile` valida con `profileSchema`, actualiza solo la fila propia de `profiles` y llama a `revalidatePath("/dashboard", "layout")`;
  - un nombre vacío, de 51 caracteres o una zona horaria desconocida no actualiza nada y devuelve el error de campo;
  - `changePassword` verifica la actual con `signInWithPassword`, rechaza una nueva igual a la actual, llama a `updateUser` y luego a `signOut({ scope: "others" })`;
  - con la actual incorrecta no cambia nada y devuelve "La contraseña actual no es correcta.".

  Archivo `src/app/dashboard/settings/account-actions.ts` con estas dos acciones.
  Hecho cuando: `npm test -- account-profile-password-actions` en verde. Cubre: RF-13, RF-14, RF-15, RF-30, RF-31, RF-32, RF-33 | Módulo: account-actions

- [x] T14 Pedir el cambio de email con `requestEmailChange` y leer el cambio pendiente
  Pasos: tests primero en `tests/unit/account-email-action.test.ts`. Comprueba que:
  - verifica la contraseña actual con `signInWithPassword` y, si es incorrecta, no inicia el cambio;
  - un email no válido o igual al actual no llama a `updateUser`;
  - una dirección ya usada devuelve "Esa dirección ya la usa otra cuenta.";
  - un cambio aceptado llama a `updateUser({ email })` y deja el estado "pendiente de confirmar";
  - `getPendingEmail` devuelve `new_email` del usuario de la sesión, o nulo si no hay cambio pendiente.

  Acción en `account-actions.ts` y lectura en `src/lib/account/queries.ts`.
  Hecho cuando: `npm test -- account-email-action` en verde. Cubre: RF-6, RF-7, RF-8, RF-9, RF-10 | Módulo: account-actions, queries
  Ajuste al cerrar: la lectura es `getAccountEmails`, que devuelve el email actual y el pendiente, porque Ajustes muestra los dos. Una dirección ya usada se muestra como error del campo, no del formulario.

- [x] T15 Borrar la cuenta con `deleteAccount`
  Pasos: test primero en `tests/unit/account-delete-action.test.ts`. Comprueba que:
  - la acción exige que el email escrito coincida con el de la sesión y que la contraseña sea correcta (`signInWithPassword`); si no, no llama a `delete_own_account` (RF-17);
  - con ambos correctos llama a `delete_own_account`, cierra la sesión local y redirige a `/login`;
  - un error de la función se muestra con el mensaje de conexión, sin cerrar la sesión.

  Acción `deleteAccount` en `account-actions.ts`.
  Hecho cuando: `npm test -- account-delete-action` en verde. Cubre: RF-16, RF-17, RF-19 | Módulo: account-actions

- [x] T16 Crear los formularios de perfil y de contraseña
  Pasos: tests primero en `tests/unit/profile-form.test.tsx` y `tests/unit/password-form.test.tsx` (Testing Library, textos en español). Comprueban que:
  - el formulario de perfil muestra nombre y zona horaria con los valores actuales, y los errores de campo enlazados con `aria-describedby`;
  - el de contraseña pide la actual y la nueva, y muestra "La contraseña nueva no puede ser igual a la actual." cuando la acción lo devuelve;
  - ambos desactivan el botón mientras envían.

  Componentes `src/components/account/profile-form.tsx` y `password-form.tsx`, con los componentes de `components/ui/`.
  Hecho cuando: `npm test -- profile-form password-form` en verde. Cubre: RF-13, RF-14, RF-15, RF-30, RF-31, RF-32 | Módulo: profile-form, password-form

- [x] T17 Crear el formulario de email y el diálogo de borrado de cuenta
  Pasos: tests primero en `tests/unit/email-form.test.tsx` y `tests/unit/delete-account-dialog.test.tsx`. Comprueban que:
  - el formulario de email pide la dirección nueva y la contraseña actual, y muestra "Cambio pendiente de confirmar: <dirección>" cuando hay uno (RF-10);
  - el diálogo advierte de que el borrado es irreversible, pide el email y la contraseña, y no envía hasta que ambos estén escritos;
  - un error de la acción se muestra en el propio diálogo.

  Componentes `email-form.tsx` y `delete-account-dialog.tsx` (reutiliza `ConfirmDialog`).
  Hecho cuando: `npm test -- email-form delete-account-dialog` en verde. Cubre: RF-6, RF-10, RF-16, RF-17 | Módulo: email-form, delete-account-dialog

- [x] T18 Ampliar Ajustes con las cuatro secciones de cuenta
  Pasos: test primero en `tests/unit/settings-page.test.tsx`: la página muestra las secciones Perfil, Email, Contraseña y Cuenta bajo el acento actual, y con `?confirm=invalid` muestra "El enlace no es válido o ha caducado. Pide uno nuevo.". Página `src/app/dashboard/settings/page.tsx`, con una sección por `<Suspense>` como la del acento. Capturas a 390, 768 y 1440 px.
  Hecho cuando: `npm test -- settings-page` en verde y las cuatro secciones se ven y funcionan en el navegador con un usuario de prueba, a 390 y 1440 px. Cubre: RF-6, RF-10, RF-12, RF-13, RF-16, RF-30 | Módulo: settings page
  Ajuste al cerrar: una página de servidor asíncrona no se renderiza en jsdom, así que el test unitario cubre la lógica del aviso (`getConfirmNotice`, `tests/unit/settings-confirm-notice.test.ts`) y las cuatro secciones se revisan en el navegador en T23, junto con el resto de pantallas.

- [x] T19 Leer los avisos y los calendarios sin propietario
  Pasos: tests primero. En `tests/unit/orphan-deadline.test.ts`: `daysLeft` calcula los días que quedan hasta los 15 desde `orphaned_at` (15, 1, 0 y vencido). En `tests/integration/account-queries.test.ts`: un miembro ve sus avisos y los calendarios sin propietario con su plazo, y no ve los de otro usuario. Funciones en `src/lib/account/orphan.ts` (puras) y `queries.ts` (lecturas con RLS).
  Hecho cuando: `npm test -- orphan-deadline` y `npm run test:db -- account-queries` en verde. Cubre: RF-22, RF-23, RF-26 | Módulo: queries, orphan

- [x] T20 Marcar avisos como leídos y decidir sobre un calendario con `orphan-actions`
  Pasos: tests primero. En `tests/integration/account-notices-read.test.ts`: un usuario puede poner `read_at` en su aviso y no en el de otro, y no puede cambiar otras columnas. En `tests/unit/orphan-actions.test.ts`: `decideOrphanCalendar(id, keep)` llama a `decide_orphan_calendar`, traduce `CF404` a "Este calendario ya no está disponible." y llama a `revalidatePath`; `dismissNotice(id)` marca el aviso como leído. Migración con permiso de `UPDATE (read_at)` y política de fila propia sobre `account_notices` (D10). `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- account-notices-read account-schema` y `npm test -- orphan-actions` en verde. Cubre: RF-23, RF-24, RF-25 | Módulo: orphan-actions, account_orphan_schema

- [ ] T21 Mostrar los avisos y las decisiones en Mis calendarios
  Pasos: tests primero en `tests/unit/notice-list.test.tsx` y `tests/unit/orphan-calendar-item.test.tsx`. Comprueban que:
  - la lista de avisos nombra a la persona y al calendario, y permite cerrar cada aviso;
  - cada calendario sin propietario muestra los días que quedan y los botones "Conservar" y "Salir" (con confirmación para "Salir"), y la decisión ya tomada;
  - sin avisos ni calendarios sin propietario, el bloque no aparece.

  Componentes `notice-list.tsx` y `orphan-calendar-item.tsx`, y modificación de `src/app/dashboard/calendars/page.tsx`. Capturas a 390, 768 y 1440 px.
  Hecho cuando: `npm test -- notice-list orphan-calendar-item` en verde y el flujo se prueba en el navegador con tres usuarios de prueba (propietario que borra, dos miembros que deciden). Cubre: RF-23, RF-24, RF-25 | Módulo: notice-list, orphan-calendar-item, calendars page

- [ ] T22 Indicar en Miembros que el calendario no tiene propietario y comprobar los permisos
  Pasos: tests primero. En `tests/integration/account-orphan-permissions.test.ts`: en un calendario sin propietario, un editor sigue pudiendo crear eventos, un lector sigue sin poder, y nadie puede editar el nombre ni el color. En `tests/unit/members-orphan-notice.test.tsx`: la página de miembros muestra "Sin propietario, plazo hasta <fecha>" y oculta los controles de rol y de expulsar. Modificación de `src/app/dashboard/calendars/[id]/members/page.tsx`.
  Hecho cuando: `npm run test:db -- account-orphan-permissions` y `npm test -- members-orphan-notice` en verde. Cubre: RF-22, RF-24 | Módulo: members page

- [ ] T25 Mostrar el autor del evento en su detalle
  Pasos: tests primero. En `tests/unit/author-label.test.ts`: la función pura `authorLabel(createdBy, members)` devuelve el nombre si el autor es un miembro, "Cuenta borrada" si `createdBy` es nulo y "un antiguo miembro" si tiene id pero no está entre los miembros. En `tests/unit/event-detail.test.tsx` (ampliar): el detalle muestra "Creado por <texto>" en los tres casos. Se añade `createdBy` al detalle del evento y se resuelve el nombre con `calendar_members_with_names`. Añadida a petición del usuario tras aprobar esta iteración (por eso la iteración llega a 13 tareas).
  Hecho cuando: `npm test -- author-label event-detail` en verde y, en el navegador, un evento de una cuenta borrada de prueba muestra "Creado por Cuenta borrada". Cubre: RF-34, RF-35, RF-36 | Módulo: event-detail, author-label

- [ ] T23 Validar la cobertura RF por RF y el flujo completo en navegador
  Pasos: recorrer la trazabilidad de RF-1 a RF-36. Probar en `playwright-cli` contra dev, a 390 y 1440 px, con usuarios de prueba que se borran al terminar: editar perfil, cambiar contraseña, pedir cambio de email, borrar una cuenta con un calendario compartido, y las dos decisiones de los miembros, sin dejar datos en dev. Revisar que nada de "Fuera de alcance" está en el código.
  Hecho cuando: checklist RF-1 a RF-36 con el test que cubre cada uno, demo manual del flujo de borrado con decisión de los miembros, y `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run test:db` en verde. Cubre: todos | Módulo: validación

- [ ] T24 Actualizar la documentación y preparar el paso a producción
  Pasos: actualizar `AGENTS.md` (estado de la spec, rutas nuevas, tablas, funciones, trabajos programados, configuración de Brevo y de Auth en producción) y `docs/constitution.md` si procede, y redactar los comandos exactos para producción: `npx supabase link --project-ref yznbdoskvtxeasujtirk`, `npx supabase db push`, volver a enlazar dev, los secretos de Vault y la configuración de Auth en prod. No se aplica nada en producción: lo ejecuta el usuario.
  Hecho cuando: `AGENTS.md` refleja la spec 006, la lista de comandos y pasos de producción está en `specs/006-gestion-de-cuenta/` y el usuario la ha revisado. Cubre: todos | Módulo: documentación

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

Iteración 2 (T13 a T24):
- RF-6 -> T14, T17, T18
- RF-7 -> T14
- RF-8 -> T14
- RF-9 -> T14 (el correo de Auth se configuró en T9)
- RF-10 -> T14, T17, T18
- RF-12 -> T18 (aviso en Ajustes)
- RF-13 -> T13, T16, T18
- RF-14 -> T13, T16
- RF-15 -> T13, T16
- RF-16 -> T15, T17, T18
- RF-17 -> T15, T17
- RF-19 -> T15
- RF-22 -> T19, T22
- RF-23 -> T19, T20, T21
- RF-24 -> T20, T21, T22
- RF-25 -> T20, T21
- RF-26 -> T19 (plazo visible)
- RF-30 -> T13, T16, T18
- RF-31 -> T13, T16
- RF-32 -> T13, T16
- RF-33 -> T13
- RF-34 -> T25
- RF-35 -> T4 (deja el autor a nulo), T25
- RF-36 -> T25
- RF-1 a RF-36 (validación y cierre) -> T23, T24

## Dudas abiertas
- [NECESITA ACLARACIÓN: T1 (a) depende de que Postgres pueda borrar `auth.users` desde una función. Si no se puede, D1 se revisa con el usuario antes de T4.]
- [NECESITA ACLARACIÓN: T9 depende de que la notificación de cambio de email de Auth esté disponible en este proyecto. Si no, el aviso al correo anterior sale por la cola propia (D4) y se añade a T8.]
- Resuelta (2026-10-23): el detalle del evento muestra el autor, con "Cuenta borrada" cuando ya no existe. Es la tarea T25 (spec RF-34 a RF-36).
- Resuelta (2026-10-23): T20 usa un permiso de columna `UPDATE (read_at)` con política de fila propia.
