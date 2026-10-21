# Tasks 003 - Compartición de calendarios

> Estado: **Aprobadas** por el usuario (2026-10-21). Ninguna tarea empezada.
> Spec: `specs/003-comparticion/spec.md`. Plan: `specs/003-comparticion/plan.md`.
> Reglas: una tarea cada vez, test primero (rojo → verde), y al cerrar cada tarea se ejecuta y reporta el checklist de "Verificación obligatoria" de la constitución (P7, P8): `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`, más `npm run test:db` si toca esquema, RLS o acceso a datos, y prueba manual en móvil (≤ 768 px) y escritorio si toca interfaz. Un commit por tarea citándola, en la rama `003-comparticion`.
> Para las demos manuales hacen falta **dos cuentas**: se prueba con `playwright-cli` y dos sesiones (`-s=`) contra `dev` (ver `AGENTS.md`, sección 10) y los usuarios de prueba se borran al terminar. Las páginas siguen el patrón de la spec 002: `page.tsx` síncrono, `params` y `searchParams` esperados en un componente `async` bajo `<Suspense>`, `revalidatePath("/dashboard", "layout")` antes de cada `redirect()` y campos no controlados con `useId()`.

## Tareas

- [x] T1 Crear la migración de tablas, políticas, trigger y lista de miembros con nombres, con su matriz de permisos
  Pasos: test primero en `tests/integration/sharing-tables.test.ts` con Propietario, Editor, Lector, ajeno y `anon` (las filas de `calendar_invites` y `calendar_access_codes` se insertan con la clave secreta, solo en `tests/`):
  - invitaciones y códigos: el propietario lee sus filas sin `token_hash` ni `pin_hash` (pedir esas columnas falla con `42501`); Editor, Lector, ajeno y `anon` no ven nada; nadie escribe directamente; `join_attempts` no se puede leer ni escribir;
  - `calendar_members`: el propietario cambia el rol de otros entre Lector y Editor, no puede ponerlo a `owner` ni cambiar la fila del propietario, ni cambiar `user_id` o `calendar_id` (permiso por columna); Editor y Lector no cambian roles; el propietario borra a otros y cualquier no propietario borra su propia fila; el propietario no puede borrar la suya; Editor y Ajeno no borran a otros; el INSERT directo sigue rechazado con `42501` para todos;
  - trigger: al borrar una membresía se borran las preferencias de ese usuario sobre ese calendario y se conservan los eventos y categorías que creó (RF-30, RF-31);
  - `calendar_members_with_names`: un miembro recibe nombre visible y rol de todos los miembros (también el propietario) y nada más; un ajeno recibe cero filas; con varios calendarios solo salen aquellos de los que es miembro; `anon` no puede llamarla.
  Reescribir en `tests/integration/rls.test.ts` el caso "nobody modifies or deletes memberships" (el propietario ya puede expulsar; el INSERT directo sigue prohibido). Migración `supabase/migrations/<timestamp>_sharing_tables_and_policies.sql` (tablas, permisos por columna, políticas, trigger, `create extension if not exists pgcrypto with schema extensions`) y `<timestamp>_members_with_names.sql`; `npm run db:push` (comprobando antes que el link apunta a `dev`) y `npm run db:types`.
  Hecho cuando: `npm run test:db -- sharing-tables rls merge-calendars schema` en verde (el test existente "members (RF-55)" de `merge-calendars` sigue en verde y cubre RF-38) y `src/types/database.ts` contiene `calendar_invites`, `calendar_access_codes`, `join_attempts` y `calendar_members_with_names`. Cubre: RF-11, RF-16, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-38 | Módulo: SQL (`sharing_tables_and_policies`, `members_with_names`)

- [x] T2 Crear las funciones SQL de invitación por enlace con sus tests de base de datos
  Pasos: test primero en `tests/integration/invites.test.ts`: `create_invite` devuelve un token de 43 caracteres y guarda solo su SHA-256, con caducidad a 7 días; rechaza rol `owner` y usos 0 o 21 con `22023` y a no propietarios con `42501`; `get_invite_preview` devuelve nombre del calendario, nombre del propietario y rol sin modificar nada, indica si la persona ya es miembro y no devuelve filas si la invitación está revocada, caducada (se retrasa `expires_at` con la clave secreta), agotada, inexistente o su calendario se borró; `accept_invite` añade con el rol de la invitación y consume un uso, no consume ni cambia el rol si ya es miembro (también el propietario), falla con `CF404` si no es válida y deja de aceptar al llegar al máximo de usos; `revoke_invite` es inmediato y no afecta a quien ya se unió; dos personas que compiten a la vez por el último uso (`Promise.all`) dan exactamente un éxito y un `CF404`; `anon` no puede llamar a ninguna. Migración `<timestamp>_invite_functions.sql` (`SECURITY DEFINER`, `search_path = ''`, revocadas a `public` y `anon`); `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- invites` en verde con todos los casos, incluida la carrera por el último uso, y `npm run test:db -- sharing-tables` sigue en verde. Cubre: RF-1, RF-3, RF-4, RF-5, RF-6, RF-8, RF-9, RF-10, RF-12, RF-13, RF-29 | Módulo: SQL (`invite_functions`)

- [x] T3 Crear las funciones SQL de ID y PIN con límites de intentos y sus tests de base de datos
  Pasos: test primero en `tests/integration/access-codes.test.ts`: `set_access_code` devuelve un ID de 8 caracteres del alfabeto sin `I`, `L`, `O`, `0` ni `1`, guarda el PIN solo como hash, fija el rol y activa el código; rechaza PIN de 5 o 11 dígitos o con letras con `22023`, rol `owner` con `22023` y a no propietarios con `42501`; cambiar el PIN invalida el anterior de inmediato y mantiene el ID; `disable_access_code` hace que el ID y el PIN dejen de valer y reactivar exige elegir un PIN nuevo; `join_with_code` devuelve `ok` con el rol del código, `member` si ya es miembro (sin cambiar su rol) e `invalid` con ID en minúsculas o con espacios aceptados, PIN con espacios exteriores aceptado, PIN mal formado tratado como incorrecto y ID inexistente o desactivado sin distinguirse; límites: tras 5 fallos en 15 minutos el sexto intento devuelve `limited` aunque el PIN sea correcto, el bloqueo dura 15 minutos desde el último fallo (se retrasan filas de `join_attempts` con la clave secreta), los intentos rechazados no se registran ni los acertados cuentan, y 20 fallos de varias cuentas contra un mismo ID bloquean ese ID para una persona con el PIN correcto; se borran los intentos de más de un día. Migración `<timestamp>_access_code_functions.sql`; `npm run db:push` y `npm run db:types`.
  Hecho cuando: `npm run test:db -- access-codes` en verde con todos los casos y `npm run test:db -- sharing-tables invites` siguen en verde. Cubre: RF-14, RF-15, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-29 | Módulo: SQL (`access_code_functions`)

- [ ] T4 Implementar esquemas, mensajes de error, resumen de juntar y URL de invitación como lógica pura
  Pasos: tests primero en `tests/unit/sharing-schemas.test.ts` (rol Lector o Editor, usos 0/1/20/21, PIN de 5/6/10/11 dígitos y con letras, ID normalizado), `tests/unit/sharing-error-messages.test.ts` (`CF404`, `CF429`, `42501`, `22023`, estados `invalid` y `limited`, mensaje del propietario, código desconocido → mensaje de conexión), `tests/unit/merge-access.test.ts` (pierden el acceso los miembros de los calendarios que desaparecen que no son miembros del destino, ganan visibilidad los miembros del destino existente, el propietario nunca aparece, destino nuevo → nadie gana, sin miembros → listas vacías) y `tests/unit/invite-url.test.ts` (origen y protocolo de las cabeceras reenviadas, token codificado); módulos `src/lib/sharing/schemas.ts`, `error-messages.ts`, `merge-access.ts` e `invite-url.ts`.
  Hecho cuando: `npm test -- sharing-schemas sharing-error-messages merge-access invite-url` en verde y `package.json` sin dependencias nuevas. Cubre: RF-1, RF-2, RF-3, RF-8, RF-14, RF-15, RF-20, RF-21, RF-22, RF-28, RF-36, RF-37 | Módulo: sharing/schemas, sharing/error-messages, sharing/merge-access, sharing/invite-url

- [ ] T5 Implementar el flujo de vuelta a la invitación tras iniciar sesión o registrarse
  Pasos: tests primero en `tests/unit/next-path.test.ts` (solo `/invite/<token>` con token de 16 a 128 caracteres base64url es válido; rutas externas, `//host`, `/dashboard`, con consulta, vacío o `undefined` → `/dashboard`), ampliar `tests/unit/route-access.test.ts` (sin sesión `/invite/abc…` → `/login?next=%2Finvite%2Fabc…`; con sesión se permite; el resto igual), `tests/unit/proxy-redirect.test.ts` (entorno `node`, mockea `@supabase/ssr`: la redirección conserva la consulta `next`) y `tests/unit/auth-next-actions.test.ts` (mockea Supabase: `signIn` y `signUp` redirigen al `next` válido y a `/dashboard` si no hay o no es válido); ampliar `login-form.test.tsx` y `signup-form.test.tsx` (el campo oculto `next` toma el valor de la URL); módulos `src/lib/auth/next-path.ts`, `route-access.ts`, `src/lib/supabase/proxy.ts`, `src/components/auth/next-field.tsx` (cliente, bajo `Suspense`), `(auth)/actions.ts` y los enlaces de `AuthCard` entre login y registro, que conservan `next`.
  Hecho cuando: `npm test -- next-path route-access proxy-redirect auth-next-actions login-form signup-form` en verde y demo manual: abrir `/invite/<cualquier-token>` sin sesión lleva a `/login?next=…`, y tras entrar o registrarse vuelve a `/invite/<token>` (la página aún puede dar 404 hasta T8). Cubre: RF-7 | Módulo: route-access, proxy, auth/next-path, auth/next-field, (auth)/actions

- [ ] T6 Implementar la gestión de invitaciones por enlace: crear, copiar, listar y revocar
  Pasos: tests primero en `tests/unit/invite-form.test.tsx` (rol y usos, error de usos fuera de 1 a 20 junto al campo, el enlace se muestra tras crear y no reaparece al recargar el estado, botón deshabilitado mientras está pendiente), `tests/unit/copy-button.test.tsx` (`navigator.clipboard.writeText` con el enlace y, si falla, el texto queda seleccionable), `tests/unit/invite-list.test.tsx` (rol, usos restantes y caducidad de cada invitación, solo vigentes, revocar pide confirmación) y `tests/unit/share-actions.test.ts` (entorno `node`, mockea la sesión y `rpc`: `createInvite` construye la URL con las cabeceras, mapea errores y no devuelve el token si falla; `revokeInvite` llama a `revoke_invite`); `src/lib/sharing/queries.ts` (invitaciones vigentes), Server Actions `createInvite` y `revokeInvite` en `src/app/dashboard/calendars/[id]/share/actions.ts`, componentes `invite-form`, `copy-button` e `invite-list` y página `/dashboard/calendars/[id]/share` (404 si no es propietario).
  Hecho cuando: `npm test -- invite-form copy-button invite-list share-actions` en verde y demo manual en móvil y escritorio: crear una invitación, copiar el enlace, verla en la lista con sus usos y revocarla, y un Editor que abre la URL de `/share` recibe 404. Cubre: RF-1, RF-2, RF-3, RF-11, RF-12, RF-29 | Módulo: share/actions, invite-form, copy-button, invite-list, sharing/queries

- [ ] T7 Implementar la gestión del ID y el PIN en la página de compartir
  Pasos: tests primero en `tests/unit/access-code-panel.test.tsx` (sin código activo: formulario con rol y PIN; con código activo: ID y rol visibles, nunca el PIN, cambiar PIN, desactivar con confirmación; PIN de 5 o 11 dígitos con el error junto al campo; reactivar pide un PIN nuevo) y ampliar `tests/unit/share-actions.test.ts` (`saveAccessCode` llama a `set_access_code` con rol y PIN y mapea errores; `disableAccessCode` llama a `disable_access_code`); ampliar `sharing/queries.ts` (ID, rol y estado del código, sin el hash), Server Actions `saveAccessCode` y `disableAccessCode` y componente `access-code-panel` integrado en `/share`.
  Hecho cuando: `npm test -- access-code-panel share-actions` en verde y demo manual: activar el código con un PIN, comprobar que la página solo muestra el ID, cambiar el PIN y desactivarlo. Cubre: RF-14, RF-15, RF-16, RF-17, RF-18 | Módulo: share/actions, access-code-panel, sharing/queries

- [ ] T8 Implementar la página pública de invitación con vista previa y botón "Unirme"
  Pasos: tests primero en `tests/unit/invite-join-card.test.tsx` (válida: nombre del calendario, del propietario y rol, y botón "Unirme"; ya es miembro: aviso y enlace al calendario sin botón; no válida: "Esta invitación ya no es válida."), `tests/unit/accept-invite-action.test.ts` (entorno `node`: llama a `accept_invite`, redirige a `/dashboard/calendar` y mapea `CF404`) y `tests/unit/next-config-headers.test.ts` (`/invite/:path*` lleva `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`); ampliar `tests/unit/sw-no-data.test.ts` con `/invite/abc` (no se cachea); `sharing/queries.ts` (vista previa), `src/app/invite/[token]/page.tsx`, `invite-join-card`, Server Action `acceptInvite` y cabeceras en `next.config.ts`.
  Hecho cuando: `npm test -- invite-join-card accept-invite-action next-config-headers sw-no-data` en verde y demo manual con dos cuentas en móvil y escritorio: una crea el enlace, la otra lo abre sin sesión, entra, ve la vista previa, pulsa "Unirme" y el calendario aparece en su panel y en sus vistas, visible y al final de la lista de su propietario; abrirlo de nuevo no consume otro uso. Cubre: RF-5, RF-6, RF-8, RF-9, RF-32 | Módulo: /invite/[token], invite-join-card, invite/actions, next.config

- [ ] T9 Implementar "Unirme con código" con ID y PIN
  Pasos: tests primero en `tests/unit/join-code-form.test.tsx` (campos ID y PIN, "ID o PIN incorrectos." y el mensaje de bloqueo como alerta, botón deshabilitado mientras está pendiente, lo escrito se conserva salvo el PIN) y `tests/unit/join-code-action.test.ts` (entorno `node`: `join_with_code` con `ok` o `member` redirige a `/dashboard/calendar`, `invalid` y `limited` devuelven su mensaje); Server Action `joinWithCode` en `src/app/dashboard/join/actions.ts`, componente `join-code-form`, página `/dashboard/join` y acceso "Unirme con código" en el panel.
  Hecho cuando: `npm test -- join-code-form join-code-action` en verde y demo manual con dos cuentas: unirse con ID y PIN, fallar cinco veces y ver el bloqueo con su mensaje, y comprobar que alguien que ya es miembro no cambia de rol. Cubre: RF-19, RF-20, RF-21, RF-22, RF-23, RF-35 | Módulo: join/actions, join-code-form, /dashboard/join

- [ ] T10 Implementar la lista de miembros con cambio de rol, expulsión y abandono, y los accesos del panel
  Pasos: tests primero en `tests/unit/member-list.test.tsx` (todos ven nombre y rol incluido el propietario y ningún email; el propietario tiene selector de rol y "Expulsar" con confirmación sobre los demás y ningún control sobre sí mismo; un no propietario tiene "Salir" con confirmación), `tests/unit/members-actions.test.ts` (entorno `node`: `changeMemberRole`, `expelMember` y `leaveCalendar` sobre `calendar_members`; si la fila es la del propietario devuelve el mensaje de RF-28; 0 filas se explica como "sin permiso" o "ya no existe") y ampliar `tests/unit/calendar-list.test.tsx` (el propietario ve "Compartir y miembros"; Editor y Lector ven "Miembros" y "Salir" con confirmación); `sharing/queries.ts` (miembros), Server Actions en `src/app/dashboard/calendars/[id]/members/actions.ts`, componente `member-list`, página `/dashboard/calendars/[id]/members` (404 para ajenos) y `calendar-list`.
  Hecho cuando: `npm test -- member-list members-actions calendar-list` en verde y demo manual con tres cuentas: el propietario cambia el rol de un miembro y esa persona ve los nuevos permisos al recargar, expulsa a otro, un tercero sale por su cuenta, el calendario desaparece de su panel y los eventos que creó siguen en el calendario. Cubre: RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-33, RF-34 | Módulo: members/actions, member-list, calendar-list, sharing/queries

- [ ] T11 Implementar el aviso de miembros al juntar calendarios
  Pasos: tests primero ampliando `tests/unit/merge-form.test.tsx` (la confirmación lista por nombre a quienes perderán el acceso y a quienes pasarán a ver eventos de otros calendarios, no los lista si no hay otros miembros, con destino nuevo nadie gana, el propietario no aparece y el aviso de que no se puede deshacer se mantiene); ampliar `merge-form` para recibir los miembros por calendario y usar `merge-access`; la página `/dashboard/calendars/merge` carga los miembros con `calendar_members_with_names` sobre los calendarios propios.
  Hecho cuando: `npm test -- merge-form` en verde y demo manual con dos cuentas: juntar un calendario compartido con otro y ver los nombres correctos en la confirmación y que, tras confirmar, los miembros del que desaparece pierden el acceso y los del resultante lo conservan. Cubre: RF-36, RF-37, RF-38 | Módulo: merge-form, /dashboard/calendars/merge

- [ ] T12 Validar la spec en producción, cobertura RF por RF y fuera de alcance
  Pasos: añadir la matriz final de permisos y completar los tests que falten para que `npm run test:db` cubra Propietario, Editor, Lector, invitado y ajeno sobre invitaciones, ID y PIN y miembros; completar la tabla RF → tarea → test con evidencia en este archivo; comprobar que no hay nada de "Fuera de alcance" (sin transferir propiedad, sin envío de correos ni notificaciones, sin enlaces públicos sin cuenta, sin roles nuevos, sin dependencias nuevas en `package.json`) y que ninguna pantalla nueva desborda entre 360 y 1920 px; actualizar `AGENTS.md` (estado, rutas, esquema, funciones, estructura y trampas aprendidas) y preparar al usuario los comandos para aplicar las migraciones a prod y volver a enlazar `dev` (los ejecuta él, con `!`).
  Hecho cuando: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run test:db && npm run build` en verde con la salida reportada, migraciones aplicadas por el usuario en prod, demo manual en producción con dos cuentas en móvil y escritorio (compartir por enlace y por ID y PIN, unirse, ver la lista de miembros, cambiar un rol, expulsar, abandonar, revocar y juntar calendarios con miembros) y aprobación explícita del usuario para cerrar la spec. Cubre: todos | Módulo: validación

## Trazabilidad RF -> Tareas

- RF-1 -> T2, T4, T6
- RF-2 -> T4, T6
- RF-3 -> T2, T4, T6
- RF-4 -> T2
- RF-5 -> T2, T8
- RF-6 -> T2, T8
- RF-7 -> T5
- RF-8 -> T2, T4, T8
- RF-9 -> T2, T8
- RF-10 -> T2
- RF-11 -> T1, T6
- RF-12 -> T2, T6
- RF-13 -> T2
- RF-14 -> T3, T4, T7
- RF-15 -> T3, T4, T7
- RF-16 -> T1, T7
- RF-17 -> T3, T7
- RF-18 -> T3, T7
- RF-19 -> T3, T9
- RF-20 -> T3, T4, T9
- RF-21 -> T3, T4, T9
- RF-22 -> T3, T4, T9
- RF-23 -> T3, T9
- RF-24 -> T1, T10
- RF-25 -> T1, T10
- RF-26 -> T1, T10
- RF-27 -> T1, T10
- RF-28 -> T1, T4, T10
- RF-29 -> T1, T2, T3, T6, T10
- RF-30 -> T1, T10
- RF-31 -> T1, T10
- RF-32 -> T8
- RF-33 -> T10
- RF-34 -> T10
- RF-35 -> T9
- RF-36 -> T4, T11
- RF-37 -> T4, T11
- RF-38 -> T1, T11
- RNF (privacidad, secretos, coste cero, mobile-first, accesibilidad) -> T1, T2, T3, T8, T12

## Dudas abiertas

- Ninguna pendiente. El plan está aprobado y no deja `[NECESITA ACLARACIÓN]`.
