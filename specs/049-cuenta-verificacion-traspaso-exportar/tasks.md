# Tasks 049 — Cuenta: verificar el email, traspasar un calendario y exportar los datos

Spec: `specs/049-cuenta-verificacion-traspaso-exportar/spec.md`. Plan: `specs/049-cuenta-verificacion-traspaso-exportar/plan.md` (aprobados de antemano por el usuario el 2026-11-18). Depende de la 043 (`write-ics`).

> Estado: cerrada el 2026-11-25.

Cada tarea se hace sola y con el test primero. P8 en verde y su salida al cerrar cada una; `npm run test:db` en T1 y T3.

## Tareas

- [x] T1 Migración
  Hecho cuando: `npm run test:db -- account-more` en verde: límite de reenvío, `transfer_calendar` (solo propietario, a un miembro, no traído, revoca invitaciones, código, feed y suscripción, avisa), purga de cuentas sin confirmar que respeta a los demás.

  Cubre: RF-1, RF-6 a RF-11 | Evidencia: 2026-11-25, migración `20261130100000_account_more.sql` aplicada en dev; `npm run test:db -- account-more` 5/5 (reenvío 1/min y 3/15 min, traspaso con roles, invitaciones revocadas, código, feed y suscripción borrados, aviso y correo; rechaza a no propietarios, ajenos y traídos con `CF409`; purga solo cuentas sin confirmar); P8 en verde.
- [x] T2 Registro con confirmación
  Hecho cuando: `npm test -- signup-action login-action auth-confirm-route check-email next-path` en verde; prueba en dev con "Confirm email" activado: registro, correo de Brevo, enlace, entrada con aviso, invitación conservada.

  Cubre: RF-1 a RF-5 | Evidencia: 2026-11-25, `npx vitest run --project unit signup-action login-action auth-confirm-route check-email next-path account-confirm login-recovery-link` en verde y P8 (3864 tests, build). La prueba real con "Confirm email" activado en dev queda para el usuario: activar la opción es un ajuste del panel de Supabase (pasos 2, 5 y 6 del plan); mientras siga desactivada el registro entra al momento como antes. `account-confirm.test.ts` usaba `signup` como tipo desconocido: ahora usa `invite`.
- [x] T3 Traspaso
  Hecho cuando: `npm test -- transfer-dialog transfer-actions` en verde (confirmación escribiendo el nombre) y capturas a 390 y 1440 px.

  Cubre: RF-7 a RF-11 | Evidencia: 2026-11-25, `npx vitest run --project unit transfer-dialog transfer-actions` en verde (confirmar escribiendo el nombre, rechazo de traídos con `CF409`); P8 (3868 tests, build); capturas `capturas/traspaso-*` y `capturas/revisa-correo-*` a 390 y 1440 px, claro y oscuro. Sección "Traspasar el calendario" en Editar calendario y aviso `transferred` en la lista de avisos.
- [x] T4 ZIP sin dependencias
  Hecho cuando: `npm test -- zip-store account-files` en verde: CRC-32 de vectores conocidos, nombres UTF-8, archivo vacío, y un `.zip` generado en el test se lista con `tar -tf`.

  Cubre: RNF-1 | Evidencia: 2026-11-25, `npx vitest run --project unit zip-store account-files` 6/6 (CRC-32 de "123456789" y del zorro, bandera UTF-8, archivo vacío, `.zip` listado y extraído con `tar` de Windows); P8 (3874 tests, build).
- [x] T5 Descargar mis datos
  Hecho cuando: `npm test -- export-data export-actions` en verde (sin datos ajenos ni secretos), prueba en el navegador con imágenes y capturas del progreso.

  Cubre: RF-12 a RF-15, RNF-2 | Evidencia: 2026-11-25, `npx vitest run --project unit export-data export-actions` 6/6 (miembros solo por nombre, sin ids ni emails ajenos; pregunta con más de 300 imágenes; "Cancelar"); P8 (3880 tests, build). Prueba en Edge con `next start`: usuario con un evento, una imagen y una nota; descarga `cafam-2026-11-25.zip` que `tar -tf` lista con `LEEME.txt`, `perfil.json`, `calendarios.json`, `calendarios/Mi calendario.ics`, `comentarios.json`, `notas.json` e `imagenes/Cumple de Ana/1.jpg`. Capturas `capturas/exportar-progreso-*` y `exportar-listo-*` a 390 y 1440 px, claro y oscuro.
- [x] T6 Cierre
  Hecho cuando: AGENTS.md (autenticación y "Confirm email"), README y constitución actualizados; `python -m graphify update .`; P8 completa.

  Evidencia: 2026-11-25, AGENTS.md (autenticación, tabla, migración `account_more` pendiente en prod, §11), README y constitución; `python -m graphify update .`; P8 en verde.

## Trazabilidad

| RF | Tareas |
|----|--------|
| RF-1 a RF-6 | T1, T2 |
| RF-7 a RF-11 | T1, T3 |
| RF-12 a RF-15 | T4, T5 |
