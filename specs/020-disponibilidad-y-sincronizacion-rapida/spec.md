# Spec 020 — Disponibilidad en el calendario y sincronización rápida

> Estado: **Aprobada** por el usuario el 2026-11-08.

## Contexto y objetivo

Para quedar en familia hay que saber cuándo están libres los demás. Hoy solo lo sabe el asistente de chat (spec 015), con el permiso "Permitir que el asistente de otros consulte mi disponibilidad". Google lo resuelve dejando compartir un calendario "solo libre/ocupado": se ven bloques "Ocupado" sin título (auditoría del 2026-11-02, `specs/019-escritorio-movil-tiempo-real/analisis-google-calendar.md`).

Además, lo que se cambia en Google tarda hasta una hora en llegar a CaFam, y lo de iCloud también. Con eso, el calendario familiar no es de fiar. Es la queja más repetida de los usuarios de Google: "se pierden los cambios", el 12 % de las 510 reseñas.

Esta spec añade dos cosas:
- la disponibilidad de otras personas en la rejilla de semana y día, solo con su consentimiento;
- traer los cambios de Google en minutos y los de iCloud cada 15 minutos.

Las dos se hacen sin coste.

## Usuarios / actores

- **Persona que consiente**: activa en Ajustes que los demás vean cuándo está ocupada.
- **Persona que mira**: comparte al menos un calendario con quien consiente y elige ver su disponibilidad.
- **Propietario de una cuenta conectada** de Google o iCloud (specs 007, 009 y 018): sus calendarios traídos se actualizan antes.
- **Miembros de un calendario traído**: ven antes los cambios.

## Historias de usuario

- H1: Como madre quiero ver en mi semana cuándo están ocupados mis hijos, para proponer un plan sin preguntar uno a uno.
- H2: Como usuario quiero decidir si los demás ven mi disponibilidad, sin enseñar qué hago.
- H3: Como usuario que apunta las cosas en Google Calendar quiero que CaFam las tenga en pocos minutos.
- H4: Como usuario de iPhone quiero que lo que apunto en Calendario de Apple llegue a CaFam en menos de una hora.

## Requisitos funcionales (criterios de aceptación en EARS)

### Consentimiento

- RF-1: EL SISTEMA ofrecerá en Ajustes la opción "Mostrar a los demás cuándo estoy ocupado en su calendario", desactivada por defecto.
- RF-2: EL SISTEMA mantendrá esa opción separada del permiso del asistente de la spec 015: activar una no activa la otra.
- RF-3: EL SISTEMA explicará junto a la opción que los demás solo verán bloques "Ocupado", sin título, lugar, descripción ni calendario, y que solo la verán personas con las que comparte algún calendario.
- RF-4: CUANDO el usuario desactive la opción, EL SISTEMA dejará de mostrar su disponibilidad a los demás en la siguiente lectura de su calendario, como mucho en 5 segundos.

### Ver la disponibilidad de otros

- RF-5: EL SISTEMA ofrecerá en los filtros del calendario una sección "Disponibilidad" con las personas que comparten algún calendario con el usuario y han activado la opción de RF-1.
- RF-6: EL SISTEMA dejará marcar y desmarcar a cada persona de la sección "Disponibilidad", con todas desmarcadas por defecto.
- RF-7: EL SISTEMA guardará en la cuenta del usuario qué personas ha marcado.
- RF-8: MIENTRAS haya personas marcadas, EL SISTEMA mostrará en las vistas semana y día los intervalos en que cada una está ocupada, como bloques "Ocupado · <nombre>".
- RF-9: EL SISTEMA distinguirá los bloques "Ocupado" de los eventos con un estilo propio (sin relleno pastel) y con el color del avatar de la persona.
- RF-10: EL SISTEMA formará los intervalos ocupados con los eventos con hora de todos los calendarios de esa persona, también los que el usuario no puede ver, sin revelar nada más que el inicio y el fin.
- RF-11: EL SISTEMA mostrará los eventos de día completo de esa persona como un bloque "Ocupado · <nombre>" en la franja de día completo, igual que el asistente los cuenta como ocupados todo el día (spec 015, RF-18).
- RF-12: EL SISTEMA juntará en un solo bloque los intervalos ocupados de una misma persona que se solapen o se toquen.
- RF-13: SI un intervalo ocupado de otra persona coincide exactamente con un evento que el usuario ya ve en la rejilla, ENTONCES EL SISTEMA no mostrará ese bloque "Ocupado".
- RF-14: CUANDO el usuario pulse un bloque "Ocupado", EL SISTEMA mostrará solo el nombre de la persona y las horas, sin enlace a ningún evento.
- RF-15: EL SISTEMA no dejará mover, redimensionar, copiar, borrar ni abrir el menú de un bloque "Ocupado".
- RF-16: EL SISTEMA no mostrará bloques "Ocupado" en las vistas mes y agenda.
- RF-17: SI una persona marcada desactiva la opción o deja de compartir calendarios con el usuario, ENTONCES EL SISTEMA dejará de mostrar sus bloques y la quitará de la sección "Disponibilidad".
- RF-18: EL SISTEMA solo dará los intervalos ocupados de un periodo de 32 días o menos por petición.

### Cambios de Google en minutos

- RF-19: CUANDO Google avise de que ha cambiado un calendario traído, EL SISTEMA lo actualizará en 2 minutos o menos desde el aviso.
- RF-20: EL SISTEMA pedirá a Google los avisos de cada calendario traído de Google al traerlo o al volver a conectar su cuenta, y los renovará antes de que caduquen.
- RF-21: SI llega un aviso que no corresponde a ningún calendario traído o cuya identificación no coincide con la que EL SISTEMA guardó, ENTONCES EL SISTEMA lo ignorará sin actualizar nada.
- RF-22: CUANDO el usuario deje de traer un calendario o desconecte la cuenta, EL SISTEMA cancelará sus avisos en Google.
- RF-23: SI Google no permite recibir avisos o deja de enviarlos, ENTONCES EL SISTEMA seguirá actualizando como mínimo cada 15 minutos.
- RF-24: CUANDO lleguen varios avisos del mismo calendario en menos de 1 minuto, EL SISTEMA hará una sola actualización.
- RF-25: EL SISTEMA respetará la espera de 5 minutos de "Actualizar ahora" (spec 007) solo para la actualización manual, no para la que lanzan los avisos.

### iCloud cada 15 minutos

- RF-26: EL SISTEMA comprobará cada 15 minutos si ha cambiado cada calendario traído de iCloud.
- RF-27: CUANDO un calendario de iCloud no haya cambiado desde la última comprobación, EL SISTEMA no descargará sus eventos.
- RF-28: CUANDO un calendario de iCloud haya cambiado, EL SISTEMA lo actualizará en esa misma comprobación.

### Lo que no cambia

- RF-29: EL SISTEMA mantendrá los avisos de fallo de la spec 007 (permiso retirado, tres fallos seguidos), contando los fallos de todas las actualizaciones, también las lanzadas por avisos.
- RF-30: EL SISTEMA mostrará en "Mis calendarios" y en la ficha de la cuenta la hora de la última actualización correcta, también cuando la lanzó un aviso.

## Requisitos no funcionales

- Coste cero (P2): ni los avisos de Google Calendar ni CalDAV cuestan dinero. El plan dirá cuántas llamadas a la función de Vercel (plan Hobby), a Google y a iCloud se hacen al día con 20 calendarios traídos, y que caben en los límites gratuitos.
- Privacidad (P3): la disponibilidad de otra persona sale de la base de datos ya reducida a inicio y fin, solo para quien comparte calendario con ella y solo si consintió; los tests de base de datos lo comprueban con un usuario ajeno y con una persona que no consintió. La política de privacidad (`/privacy`) explicará la nueva opción.
- Seguridad: el punto que recibe los avisos de Google es público, así que solo actúa ante avisos con la identificación guardada, nunca escribe datos que vengan en el aviso y responde igual a un aviso válido que a uno falso.
- Secretos (P4): la identificación de los avisos no sale al navegador.
- Identidad visual (P9): los bloques "Ocupado" solo usan tokens y se revisan a 390, 768 y 1440 px con los acentos rojo y amarillo, en claro y oscuro.

## Casos límite

- **Una persona que consiente pero no comparte ningún calendario** con el usuario: no aparece (RF-5).
- **Persona con un evento privado de 9 a 10 y otro de 9:30 a 11**: un solo bloque de 9:00 a 11:00 (RF-12).
- **Evento de la persona que el usuario ya ve** porque comparten ese calendario: no se duplica (RF-13); si además tiene otro evento a la vez que el usuario no ve, sí sale un bloque "Ocupado".
- **Repeticiones**: cuentan cada una como un intervalo ocupado.
- **Zonas horarias distintas**: los intervalos se muestran en la zona del perfil de quien mira.
- **Semana con 8 personas marcadas**: los bloques comparten la columna como los eventos solapados; el plan fija el máximo de personas a la vez si hace falta.
- **Cuenta borrada** de una persona marcada: desaparece de la sección.
- **Aviso de Google mientras el calendario ya se está actualizando**: se encadena una actualización al terminar (RF-24).
- **Aviso de un calendario que el usuario borró en CaFam** pero sigue en Google: se ignora (RF-21) y se cancela al detectarlo.
- **Google retira el permiso**: el aviso de la spec 007 (`sync_revoked`) sale como hoy y se dejan de renovar los avisos.
- **iCloud responde con un error temporal** en la comprobación: cuenta como fallo de la spec 007 y se reintenta en la siguiente.
- **Desarrollo en local**: Google no puede avisar a `localhost`; en dev se prueba con la comprobación cada 15 minutos y simulando avisos.

## Fuera de alcance

- Compartir un calendario con un rol nuevo "solo libre/ocupado".
- Bloques "Ocupado" en la vista mes o en la agenda, y elegir unos calendarios de la persona sí y otros no.
- Proponer horas o crear eventos a partir de la disponibilidad (el asistente ya lo hace, spec 015).
- Avisos de iCloud en tiempo real (CalDAV no los ofrece).
- Notificaciones push al usuario cuando cambia algo.
- Calendarios en paralelo en la vista de día (una columna por persona).
- Que los cambios aparezcan en la pantalla sin recargar: lo hace la spec 019 para cualquier cambio de la base de datos, también los de la sincronización.

## Criterios de finalización

- RF-1 a RF-30 con su test o comprobación manual en verde.
- Prueba con dos usuarios: el que consiente ve que el otro solo recibe inicio y fin (inspección de la respuesta) y, al retirar el consentimiento, sus bloques desaparecen.
- Prueba en producción: un evento creado en Google Calendar aparece en CaFam en 2 minutos o menos, y uno creado en el iPhone, en 15 minutos o menos.
- Verificación obligatoria completa (P8), con `test:db`, y la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Resuelta el 2026-11-08 al aprobar la spec: si Google exige verificar el dominio que recibe los avisos y `calendario-familia-five.vercel.app` no se puede verificar gratis, la spec se queda en "como mínimo cada 15 minutos" para Google (RF-23) en lugar de los 2 minutos de RF-19.
- Decisiones tomadas por defecto que el usuario puede cambiar al aprobar:
  - El consentimiento para la rejilla es distinto del del asistente, porque quien lo dio para el asistente no aceptó que se viera en el calendario de los demás.
  - Los eventos de día completo cuentan como ocupados y salen en la franja de día completo, para que el asistente y la rejilla digan lo mismo.
  - Solo en semana y día, como el "libre/ocupado" de Google.
