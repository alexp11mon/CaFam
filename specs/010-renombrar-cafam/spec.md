# Spec 010 — Renombrar el proyecto a CaFam

## Contexto y objetivo

El proyecto ha tenido dos nombres, "CalendarioFamilia" (repositorio, carpeta, `package.json`, configuración de Supabase) y "CalenderFam" (marca visible, PWA, correos, tests), además del nombre corto "CaFam". Tener tres nombres confunde a quien usa la app y a quien trabaja en el código. Desde la enmienda 3 de la constitución (2026-10-29) el proyecto se llama **CaFam** en todas partes. Esta spec hace ese cambio de una vez, sin cambiar ningún comportamiento de la app. Es la primera de las seis specs del plan de mejoras (010 a 015).

## Usuarios / actores

- **Usuario de la app**: ve el nombre en la portada, la pestaña del navegador, la app instalada, la barra lateral, la política de privacidad y los correos.
- **Miembro de un calendario sin propietario**: recibe el aviso por correo cuando alguien borra su cuenta (spec 006).
- **Desarrollador o agente de IA**: lee la documentación, las specs, los comentarios y la configuración.
- **Propietario del proyecto** (el usuario): ejecuta las acciones externas (repositorio de GitHub, migración en producción, paneles de Supabase y Brevo).

## Historias de usuario

- H1: Como usuario quiero ver siempre el mismo nombre, CaFam, para saber que todo es la misma app.
- H2: Como usuario que recibe un correo de la app quiero que el remitente y el texto digan CaFam para reconocerlo.
- H3: Como desarrollador quiero que el repositorio, la documentación y el código usen un solo nombre para no dudar cuál es el correcto.

## Requisitos funcionales (criterios de aceptación en EARS)

### Interfaz y PWA

- RF-1: EL SISTEMA mostrará "CaFam" como título por defecto de la pestaña del navegador y como sufijo del título de cada página ("Ajustes · CaFam").
- RF-2: EL SISTEMA declarará "CaFam" como nombre y como nombre corto de la app instalable.
- RF-3: EL SISTEMA mostrará "CaFam" en el logotipo con texto, en el nombre accesible del enlace de inicio de la barra lateral, en la ayuda de instalación de iOS y en la política de privacidad.
- RF-4: EL SISTEMA conservará la marca gráfica "CF" del icono y del logotipo, porque son las iniciales de CaFam.
- RF-5: CUANDO un navegador cargue el nuevo service worker, EL SISTEMA usará una caché con el nombre nuevo y borrará la caché anterior (`calenderfam-v2`).
- RF-6: CUANDO la app descargue un calendario `.ics` desde un enlace, EL SISTEMA se identificará ante el servidor remoto con un agente de usuario que diga CaFam.

### Correo

- RF-7: CUANDO la app envíe un correo de aviso de cuenta, EL SISTEMA usará "CaFam" como nombre del remitente.
- RF-8: CUANDO alguien borre su cuenta y deje calendarios compartidos sin propietario, EL SISTEMA redactará el correo de aviso a los miembros con el nombre CaFam.
- RF-9: SI un correo ya estaba en la cola de envío con el texto antiguo, ENTONCES EL SISTEMA lo enviará con el remitente nuevo sin reescribir su texto.

### Repositorio, código y documentación

- RF-10: EL SISTEMA no contendrá "CalendarioFamilia", "CalenderFam", "calenderfam" ni "calendariofamilia" (sin distinguir mayúsculas) en ningún archivo versionado, salvo en las migraciones ya aplicadas, que no se editan, y en la propia descripción de este cambio (esta spec, su plan y sus tareas).
- RF-11: EL SISTEMA conservará la URL de producción `calendario-familia-five.vercel.app` allí donde aparezca, porque no contiene ninguno de los nombres prohibidos por RF-10 y cambiarla rompería los enlaces y el OAuth de Google.
- RF-12: CUANDO se sustituya el nombre en las specs cerradas (001 a 009), EL SISTEMA solo cambiará el nombre, sin tocar requisitos, decisiones, tareas ni evidencias (enmienda 3).
- RF-13: EL SISTEMA documentará en `AGENTS.md` el nombre único CaFam, la enmienda 3 de la constitución y las specs 010 a 015 de la hoja de ruta.
- RF-14: EL SISTEMA tendrá una comprobación automática que falle si un archivo versionado incumple RF-10.

### Datos de prueba

- RF-15: EL SISTEMA generará los correos de los usuarios de prueba con el dominio `@cafam.test`.
- RF-16: CUANDO termine esta spec, EL SISTEMA no tendrá en el proyecto de desarrollo ningún usuario con correo `@calenderfam.test` (unos 196 antiguos, borrados con sus datos de prueba con la aprobación del usuario del 2026-10-29).
- RF-17: SI hay en producción un usuario con correo `@calenderfam.test`, ENTONCES EL SISTEMA no lo borrará en esta spec y se informará al usuario.

### Acciones externas (las ejecuta el usuario)

- RF-18: CUANDO el usuario renombre el repositorio de GitHub a `CaFam`, EL SISTEMA (remoto local de git y despliegue de Vercel) seguirá funcionando con el nombre nuevo.
- RF-19: CUANDO se aplique en producción la migración de esta spec, EL SISTEMA enviará los correos de cuenta según RF-7 y RF-8 también en producción.
- RF-20: SI una plantilla de correo de Supabase Auth (recuperación o cambio de email) o el remitente configurado en Brevo muestra el nombre antiguo, ENTONCES se cambiará a CaFam en el panel de dev y de prod, con los pasos exactos preparados para el usuario.

## Requisitos no funcionales

- **Sin cambios de comportamiento**: fuera del nombre, ninguna pantalla, ruta, permiso, dato ni flujo cambia. Toda la verificación obligatoria de la constitución (P8) pasa sin tocar tests que no mencionen el nombre.
- **Coste cero** (P2): no se añade ningún servicio ni dependencia.
- **Idioma**: el nombre "CaFam" no se traduce; los textos que lo rodean siguen en español.

## Casos límite

- **App ya instalada**: Android actualiza el nombre al revisar el manifest; iOS no lo cambia hasta que se vuelve a añadir a la pantalla de inicio. No es un fallo (mismo caso que el icono en la spec 005).
- **Caché vieja del service worker**: un navegador con la caché `calenderfam-v2` la borra al activar el nuevo service worker (RF-5); hasta entonces sigue funcionando sin conexión con la antigua.
- **Remoto de git tras renombrar en GitHub**: GitHub redirige el nombre antiguo, pero el remoto local debe apuntar al nuevo para no depender de esa redirección.
- **Vercel tras renombrar el repositorio**: la integración sigue el repositorio por su identificador; si se desconecta, el usuario la vuelve a enlazar.
- **Carpeta local**: renombrarla cambia la ruta de la memoria de Claude Code para este proyecto; la memoria debe seguir disponible.
- **Nombre dentro de otros textos**: `calendario-dev`, `calendario-prod` y la URL de Vercel contienen "calendario" pero no los nombres antiguos; se conservan (RF-11).
- **Correos ya enviados**: no se pueden cambiar; solo los nuevos y los pendientes (RF-9).

## Fuera de alcance

- Cambiar la URL de producción de Vercel o comprar un dominio.
- Renombrar los proyectos de Supabase (`calendario-dev`, `calendario-prod`) o el proyecto de Vercel.
- Rediseñar el logotipo o los iconos (la marca "CF" se queda; el rediseño visual es la spec 011).
- Editar las migraciones ya aplicadas (la corrección va en una migración nueva).
- Borrar usuarios de producción.
- Cualquier cambio de comportamiento o funcionalidad nueva.

## Criterios de finalización

- RF-1 a RF-17 con su test o comprobación en verde, incluida la comprobación automática de RF-14.
- Verificación obligatoria completa (typecheck, lint, format:check, test, test:db y build) con la salida reportada.
- Capturas a 390, 768 y 1440 px de la portada, la barra lateral y la política de privacidad con el nombre nuevo.
- Migración aplicada en dev y, por el usuario, en prod; usuarios `@calenderfam.test` borrados de dev.
- Repositorio de GitHub renombrado, remoto local actualizado y despliegue de Vercel funcionando (RF-18).
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna. Decidido por el usuario el 2026-10-29: nombre CaFam en todas partes, URL de Vercel conservada, cambio de nombre también en las specs cerradas y borrado de los usuarios de prueba antiguos de dev.
- Nombre del repositorio de GitHub y de la carpeta local: `CaFam` salvo que el usuario diga otro al aprobar esta spec.
