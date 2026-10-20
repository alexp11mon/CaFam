# Spec 001 — Base de la aplicación

> Estado: **Borrador, pendiente de aprobación**. Constitución: `docs/constitution.md`.

## Contexto y objetivo

CalendarioFamilia necesita unos cimientos antes de construir calendarios, eventos y compartición: que una persona pueda crearse una cuenta, entrar y salir de forma segura, ver un panel con sus calendarios e instalar la aplicación en el móvil o el escritorio. Esta spec entrega además el modelo de permisos base (Propietario, Editor y Lector) para que la privacidad por defecto (constitución P3) quede garantizada desde el primer día y las specs siguientes (002 calendarios y eventos, 003 compartición) solo tengan que construir interfaz sobre reglas ya probadas. Al terminar, la app está desplegada en una URL pública, gratis (P2), y sigue disponible aunque nadie la use durante días.

## Usuarios / actores

- **Visitante:** persona sin sesión iniciada. Puede ver la portada, registrarse e iniciar sesión.
- **Usuario:** persona con cuenta y sesión iniciada. Accede a su panel.
- **Propietario:** usuario que creó un calendario. Puede verlo, modificarlo, borrarlo y gestionar sus eventos.
- **Editor:** miembro de un calendario ajeno con permiso para ver y gestionar sus eventos.
- **Lector:** miembro de un calendario ajeno con permiso solo para verlo.
- **Administrador (el autor del proyecto):** gestiona los servicios gratuitos (base de datos y hosting) desde sus paneles.

## Historias de usuario

- H1: Como visitante quiero crearme una cuenta con email y contraseña para tener mis propios calendarios.
- H2: Como usuario quiero iniciar y cerrar sesión para que nadie más use mi cuenta en un dispositivo compartido.
- H3: Como usuario quiero que la app recuerde mi sesión para no tener que entrar cada vez que la abro.
- H4: Como usuario quiero ver en mi panel la lista de calendarios a los que tengo acceso y con qué rol, para saber qué puedo hacer en cada uno.
- H5: Como usuario quiero tener ya un calendario personal al registrarme para empezar a usarlo sin pasos extra.
- H6: Como propietario quiero que nadie sin invitación pueda ver mis calendarios ni mis eventos, y que un Lector no pueda modificarlos.
- H7: Como usuario quiero instalar la app en la pantalla de inicio de mi móvil (iOS o Android) y en mi ordenador para abrirla como una app más.
- H8: Como usuario quiero ver un aviso claro si abro la app sin conexión en lugar de un error del navegador.

## Requisitos funcionales (criterios de aceptación en EARS)

### Registro

- RF-1: CUANDO un visitante envía el formulario de registro con un nombre visible, un email válido y una contraseña de al menos 8 caracteres, EL SISTEMA creará la cuenta, iniciará sesión y mostrará el panel.
- RF-2: SI el email del registro ya pertenece a una cuenta (comparación sin distinguir mayúsculas y sin espacios exteriores), ENTONCES EL SISTEMA no creará la cuenta y mostrará "Ya existe una cuenta con este email.".
- RF-3: SI algún campo del registro está vacío, el email no tiene formato válido o la contraseña tiene menos de 8 caracteres, ENTONCES EL SISTEMA no enviará el formulario y mostrará el error en español junto al campo afectado.
- RF-4: CUANDO se crea una cuenta, EL SISTEMA creará un calendario llamado "Mi calendario" cuyo propietario es el nuevo usuario.
- RF-26: CUANDO se crea una cuenta, EL SISTEMA guardará en el perfil la zona horaria detectada en el navegador del visitante; SI no se puede detectar o no es una zona horaria IANA válida, ENTONCES guardará "Europe/Madrid".
- RF-27: EL SISTEMA permitirá registrarse a cualquier visitante que tenga la URL, sin lista de emails autorizados.

### Inicio y cierre de sesión

- RF-5: CUANDO un visitante envía el formulario de login con email y contraseña correctos, EL SISTEMA iniciará sesión y mostrará el panel.
- RF-6: SI el email o la contraseña del login no son correctos, ENTONCES EL SISTEMA mostrará "Email o contraseña incorrectos." sin revelar cuál de los dos falla.
- RF-7: CUANDO un usuario pulsa "Cerrar sesión", EL SISTEMA cerrará la sesión en ese dispositivo y mostrará la pantalla de login.
- RF-8: MIENTRAS no haya sesión iniciada, EL SISTEMA redirigirá cualquier acceso al panel o a sus subpáginas a la pantalla de login.
- RF-9: MIENTRAS haya sesión iniciada, EL SISTEMA redirigirá cualquier acceso a las pantallas de login o registro al panel.
- RF-10: MIENTRAS haya sesión iniciada, EL SISTEMA la conservará al recargar la página y al cerrar y volver a abrir el navegador o la app instalada, hasta que el usuario cierre sesión.
- RF-11: SI el servicio de autenticación rechaza la petición por exceso de intentos, ENTONCES EL SISTEMA mostrará "Demasiados intentos. Espera unos minutos y vuelve a probar.".
- RF-12: SI el registro o el login fallan por falta de conexión o por un error inesperado del servidor, ENTONCES EL SISTEMA mostrará "No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo." y conservará el email escrito en el formulario.

### Panel

- RF-13: CUANDO un usuario con sesión abre el panel, EL SISTEMA mostrará su nombre visible y la lista de calendarios de los que es miembro, cada uno con su nombre, su color y su rol ("Propietario", "Editor" o "Lector").
- RF-14: EL SISTEMA mostrará en el panel un botón "Cerrar sesión" visible sin hacer scroll tanto en móvil como en escritorio.

### Permisos sobre calendarios y eventos

> En esta spec estos requisitos se verifican con tests automáticos sobre la capa de datos; la interfaz que los usa llega en las specs 002 y 003.

- RF-15: EL SISTEMA solo permitirá ver un calendario, sus miembros y sus eventos a su propietario y a los miembros con rol Editor o Lector de ese calendario.
- RF-16: EL SISTEMA permitirá al propietario y a los Editores de un calendario crear, modificar y borrar sus eventos.
- RF-17: SI un Lector, o un usuario que no es miembro, intenta crear, modificar o borrar un evento de un calendario, ENTONCES EL SISTEMA rechazará la operación sin modificar ningún dato.
- RF-18: SI un usuario que no es el propietario intenta modificar o borrar un calendario, ENTONCES EL SISTEMA rechazará la operación sin modificar ningún dato.
- RF-19: SI un usuario intenta añadirse a sí mismo o a otro como miembro de un calendario, o cambiar un rol, ENTONCES EL SISTEMA rechazará la operación (la incorporación de miembros solo se habilitará mediante los mecanismos de la spec 003).
- RF-20: EL SISTEMA solo permitirá a cada usuario ver y modificar su propio perfil (nombre visible y zona horaria).

### PWA y plataformas

- RF-21: DONDE el navegador ofrezca instalación de aplicaciones web (Chrome o Edge en Android, Windows y macOS), EL SISTEMA será instalable y se abrirá en ventana propia con el nombre "CalenderFam" y su icono.
- RF-22: CUANDO un usuario añade la app a la pantalla de inicio desde Safari en iOS/iPadOS, EL SISTEMA se abrirá a pantalla completa sin barra del navegador, con su icono y el nombre corto "CaFam".
- RF-23: SI la app se abre o se navega sin conexión a una página no disponible, ENTONCES EL SISTEMA mostrará una pantalla "Sin conexión" en español con un botón "Reintentar".
- RF-24: EL SISTEMA mostrará todas sus pantallas sin scroll horizontal y con todos los controles accesibles en anchos de 360 px a 1920 px.

### Disponibilidad

- RF-25: SI la aplicación pasa 7 días o más sin que ningún usuario la use, ENTONCES EL SISTEMA seguirá respondiendo con normalidad sin intervención manual del administrador.

## Requisitos no funcionales

- RNF-1 Idioma: todos los textos visibles, incluidos los errores, en español (constitución, Convenciones).
- RNF-2 Seguridad: las contraseñas nunca se almacenan ni se registran en claro; ningún secreto llega al navegador (P4).
- RNF-3 Privacidad: la denegación es el comportamiento por defecto; un dato solo es accesible si una regla explícita lo permite (P3).
- RNF-4 Coste: toda la solución funciona en capas gratuitas sin tarjeta (P2).
- RNF-5 Plataformas: últimas dos versiones de Chrome, Edge, Safari (macOS e iOS) y Firefox; móvil iOS y Android; escritorio Windows y macOS.
- RNF-6 Rendimiento: la pantalla de login carga en menos de 3 s en un móvil con conexión 4G simulada (Chrome DevTools, perfil "Fast 4G") en el despliegue de producción.
- RNF-7 Accesibilidad: todos los campos de formulario tienen etiqueta visible, los errores se anuncian al lector de pantalla y todo el flujo de registro, login y logout se puede completar solo con teclado.
- RNF-8 Comunicaciones: toda la comunicación usa HTTPS.
- RNF-9 Identidad visual: nombre de la app "CalenderFam" y nombre corto "CaFam" (título de las pestañas, manifest e instalación). Color principal #2563EB (botones de acción, enlaces, barra de la app instalada y color por defecto de los calendarios); colores secundarios #A6E1FA (fondos y resaltados suaves) y #0D160B (texto principal). Toda combinación de texto y fondo cumple un contraste mínimo de 4,5:1 (WCAG AA).

## Casos límite

- Email con mayúsculas o espacios al principio o al final: se normaliza (minúsculas, sin espacios exteriores) antes de registrar o iniciar sesión.
- Nombre visible vacío o solo con espacios: se rechaza (RF-3); con más de 50 caracteres: se rechaza con "El nombre no puede superar los 50 caracteres.".
- Contraseña de exactamente 8 caracteres: se acepta; de 7: se rechaza (RF-3). Más de 72 caracteres: se rechaza con "La contraseña no puede superar los 72 caracteres.".
- Doble clic en "Crear cuenta" o "Entrar": el botón se desactiva mientras se procesa la petición y solo se crea una cuenta.
- Dos registros simultáneos con el mismo email: solo uno tiene éxito; el otro recibe RF-2.
- Sesión caducada o revocada mientras el panel está abierto: la siguiente navegación lleva al login (RF-8).
- Sesión cerrada en una pestaña con otra pestaña abierta: la otra pestaña lleva al login en su siguiente navegación.
- Usuario que acaba de registrarse y no tiene más calendarios: el panel muestra solo "Mi calendario" con rol "Propietario".
- Usuario sin ningún calendario (borró el suyo en una spec futura): el panel muestra "Todavía no tienes calendarios.".
- Navegador que no expone la zona horaria, o valor manipulado que no es una zona IANA válida (p. ej. llamando directamente al servicio de autenticación): el perfil queda con "Europe/Madrid" y el registro no falla (RF-26).
- Usuario que se registra estando de viaje: se guarda la zona horaria del dispositivo en ese momento; cambiarla será posible con la edición de perfil (spec 005).
- Modificación del perfil con una zona horaria no válida: se rechaza en la capa de datos.
- Evento con fecha de fin anterior a la de inicio: se rechaza en la capa de datos.
- Usuario borrado: se borran en cascada su perfil, sus calendarios (con sus eventos) y sus membresías.
- iOS: no existe aviso automático de instalación; la instalación es manual desde "Compartir > Añadir a pantalla de inicio" (RF-22).
- Contenido de páginas con sesión: no se guarda en caché offline para que otro usuario del mismo dispositivo no vea datos ajenos sin conexión.

## Fuera de alcance

- Interfaz para crear, editar o borrar calendarios y eventos, y vistas mensual, semanal y diaria (spec 002).
- Compartición: enlace de invitación, ID de calendario + PIN, gestión de miembros y roles desde la interfaz (spec 003).
- Suscripción a calendarios externos .ics (spec 004).
- Recuperación de contraseña, verificación de email, cambio de email y borrado de cuenta desde la app (spec 005). Mientras tanto, el administrador puede restablecer contraseñas desde el panel de Supabase.
- Login social (Google, Apple, Microsoft) y sincronización bidireccional por OAuth (spec 006).
- Notificaciones push o por email, recordatorios.
- Uso offline con datos (ver o editar eventos sin conexión).
- Tema oscuro, personalización visual e internacionalización a otros idiomas.
- Edición del perfil desde la interfaz (el perfil existe y está protegido, RF-20, pero su pantalla llega en spec 005).

## Criterios de finalización

- RF-1 a RF-27 con al menos un test automático o una prueba manual documentada que lo cubra (tabla de trazabilidad en `tasks.md`).
- Checklist de "Verificación obligatoria" de la constitución completo: `typecheck`, `lint`, `format:check`, `test`, `test:db` y `build` en verde.
- Demo manual en el despliegue de producción: registro → panel con "Mi calendario" → cerrar sesión → login con contraseña errónea → login correcto → recarga con sesión conservada.
- App instalada y abierta en un móvil Android o iOS real y en un escritorio.
- Nada de "Fuera de alcance" presente en el código.
- Aprobación explícita del usuario.

## Dudas abiertas

- Ninguna pendiente.

### Decisiones ya confirmadas por el usuario

- Stack Next.js + Supabase: confirmado.
- Tailwind CSS para estilos: confirmado.
- Alojamiento en Vercel: confirmado.
- Registro abierto a cualquiera que tenga la URL; los datos siguen siendo privados por P3 y, si aparece abuso, se restringe en una spec posterior (RF-27).
- Nombre de la app "CalenderFam", nombre corto "CaFam"; color principal #2563EB y secundarios #A6E1FA y #0D160B (RNF-9, RF-21, RF-22).
- Zona horaria de los nuevos usuarios detectada del navegador, con "Europe/Madrid" como respaldo (RF-26).
