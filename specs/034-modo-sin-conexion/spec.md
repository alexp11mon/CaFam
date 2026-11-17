# Spec 034 — Modo sin conexión

> Estado: **Aprobada** (2026-11-17). Decisiones tomadas en la entrevista del 2026-11-17: conflictos → preguntar; periodo guardado fijo (1 mes atrás, 3 meses adelante); series → solo "Solo este evento"; Notas incluidas (ver y editar); cerrar sesión con cambios pendientes → avisar y confirmar.

## Contexto y objetivo

Hoy, sin red, CaFam solo enseña la pantalla "Sin conexión": no se puede consultar ni apuntar nada. Así se decidió en la spec 001 para no dejar datos del usuario en el dispositivo. Pero el calendario y las notas se usan justo donde la cobertura falla (metro, avión, un sótano, el extranjero sin datos). Esta spec permite **ver** el calendario y las notas sin conexión, **crear y cambiar** eventos y notas, y **enviar esos cambios solos** al volver la red, sin pisar nunca sin preguntar lo que otra persona haya cambiado mientras tanto. Para hacerlo se revisa la decisión de la spec 001: los datos del usuario se guardan en el dispositivo mientras dura la sesión y se borran al cerrarla.

## Usuarios / actores

- **Usuario con sesión** que ha abierto CaFam con conexión al menos una vez en ese dispositivo y después se queda sin red.
- **Otros miembros** de sus calendarios, que pueden cambiar los mismos eventos y notas mientras él está sin conexión.

## Historias de usuario

- H1: Como usuario sin cobertura quiero ver mis eventos de las próximas semanas para saber dónde tengo que estar.
- H2: Como usuario sin cobertura quiero apuntar un evento nuevo o cambiar uno que ya existe para no olvidarlo hasta tener red.
- H3: Como usuario quiero que lo que cambié sin conexión llegue solo a los demás al volver la red, sin tener que repetirlo.
- H4: Como usuario quiero que, si otra persona cambió el mismo evento mientras yo estaba sin conexión, la app me pregunte qué versión conservar en vez de perder una de las dos sin avisar.
- H5: Como usuario quiero consultar y marcar mis listas (la compra, los deberes) sin conexión.
- H6: Como usuario de un dispositivo compartido quiero que al cerrar sesión no quede ningún dato mío en él.

## Requisitos funcionales (criterios de aceptación en EARS)

### Copia en el dispositivo

- RF-1: MIENTRAS haya sesión y conexión, EL SISTEMA guardará en el dispositivo los eventos de todos los calendarios de los que el usuario es miembro, desde 1 mes antes hasta 3 meses después del día de hoy, aunque el usuario no haya abierto esas fechas.
- RF-2: MIENTRAS haya sesión y conexión, EL SISTEMA guardará en el dispositivo todas las notas que el usuario puede ver, archivadas incluidas, con sus elementos.
- RF-3: MIENTRAS haya sesión y conexión, EL SISTEMA guardará en el dispositivo lo necesario para pintar la app igual que con conexión: calendarios, categorías, grupos, preferencias de visibilidad y orden, rol del usuario en cada calendario, vista recordada, zona horaria, tema, acento y opciones de vista.
- RF-4: CUANDO la app se abra con conexión, EL SISTEMA actualizará la copia del dispositivo.
- RF-5: CUANDO llegue un aviso de cambio en tiempo real, EL SISTEMA actualizará la copia del dispositivo.
- RF-6: MIENTRAS la app esté abierta con conexión, EL SISTEMA mantendrá la copia del dispositivo con una antigüedad de 15 minutos como mucho.

### Ver sin conexión

- RF-7: CUANDO el usuario abra la app sin conexión y haya una copia de su cuenta en el dispositivo, EL SISTEMA mostrará el calendario en la vista recordada con los datos de la copia, en lugar de la pantalla "Sin conexión".
- RF-8: MIENTRAS no haya conexión, EL SISTEMA permitirá cambiar entre las vistas agenda, mes, semana y día, y navegar entre periodos dentro del rango guardado.
- RF-9: MIENTRAS no haya conexión, EL SISTEMA mostrará en todas las pantallas un indicador "Sin conexión · datos de las HH:MM", con la fecha delante si la copia no es de hoy.
- RF-10: CUANDO cambie el estado de la conexión, EL SISTEMA lo anunciará a los lectores de pantalla.
- RF-11: SI el usuario navega sin conexión a un periodo fuera del rango guardado, ENTONCES EL SISTEMA mostrará "Estas fechas no están disponibles sin conexión" en lugar de un periodo vacío.
- RF-12: SI no hay conexión y no hay copia de la cuenta en el dispositivo, ENTONCES EL SISTEMA mostrará la pantalla "Sin conexión" actual.
- RF-13: MIENTRAS no haya conexión, EL SISTEMA mostrará el detalle de un evento con título, fecha y horas, lugar, descripción, calendario, categoría, color, autor y resumen de la repetición.
- RF-14: MIENTRAS no haya conexión, EL SISTEMA sustituirá las imágenes y los comentarios del detalle por el texto "Disponible con conexión".
- RF-15: MIENTRAS no haya conexión, EL SISTEMA permitirá ocultar y mostrar calendarios en los filtros solo en ese dispositivo y sin guardar la preferencia.
- RF-16: MIENTRAS no haya conexión, EL SISTEMA mostrará las Notas con su búsqueda, sus filtros y el detalle de cada nota.
- RF-17: MIENTRAS no haya conexión, EL SISTEMA mostrará los destinos que la necesitan (asistente, importar, unirme, compartir, miembros, cuentas conectadas, Ajustes, crear o editar calendarios) deshabilitados con el motivo "Necesita conexión".
- RF-18: SI una petición al servidor no responde en 10 segundos, ENTONCES EL SISTEMA se comportará como sin conexión hasta que una petición posterior responda.

### Cambiar eventos sin conexión

- RF-19: MIENTRAS no haya conexión, EL SISTEMA permitirá crear un evento sin repetición en un calendario normal en el que el usuario sea Propietario o Editor según la copia.
- RF-20: MIENTRAS no haya conexión, EL SISTEMA permitirá cambiar título, fechas, horas, día completo, descripción, lugar, color y categoría de un evento de un calendario normal en el que el usuario pueda escribir.
- RF-21: MIENTRAS no haya conexión, EL SISTEMA permitirá mover un evento a otro calendario normal en el que el usuario pueda escribir.
- RF-22: MIENTRAS no haya conexión, EL SISTEMA permitirá mover y redimensionar arrastrando, cambiar el color desde el menú, duplicar, copiar, pegar y borrar, igual que con conexión.
- RF-23: MIENTRAS no haya conexión, EL SISTEMA permitirá cambiar, mover o borrar una repetición de una serie solo con el alcance "Solo este evento".
- RF-24: MIENTRAS no haya conexión, EL SISTEMA no ofrecerá "Este y los siguientes", "Todos los eventos", crear una serie ni convertir un evento en serie, y mostrará el motivo "Necesita conexión".
- RF-25: MIENTRAS no haya conexión, EL SISTEMA tratará los calendarios traídos de Google e iCloud como de solo lectura, con el motivo "Sin conexión no se puede escribir en Google" (o "en iCloud").
- RF-26: CUANDO el usuario haga un cambio sin conexión, EL SISTEMA lo mostrará al instante en todas las vistas.
- RF-27: CUANDO el usuario haga un cambio sin conexión, EL SISTEMA lo guardará en el dispositivo de forma que sobreviva a cerrar la app y reiniciar el dispositivo.
- RF-28: MIENTRAS un evento tenga cambios sin enviar, EL SISTEMA lo marcará como "Pendiente de enviar" con un icono y el mismo texto para lectores de pantalla.
- RF-29: MIENTRAS haya cambios sin enviar, EL SISTEMA mostrará su número junto al indicador de conexión.
- RF-30: CUANDO el usuario pulse "Deshacer" en el aviso de un cambio hecho sin conexión, EL SISTEMA quitará ese cambio de los pendientes y devolverá el evento a como estaba.

### Cambiar notas sin conexión

- RF-31: MIENTRAS no haya conexión, EL SISTEMA permitirá crear una nota (lista o texto) personal o en un calendario en el que el usuario pueda escribir según la copia.
- RF-32: MIENTRAS no haya conexión, EL SISTEMA permitirá cambiar título, cuerpo, color, fecha límite, fijada y archivada de una nota que el usuario pueda escribir.
- RF-33: MIENTRAS no haya conexión, EL SISTEMA permitirá añadir, marcar, desmarcar, editar, subir, bajar y borrar elementos de una lista, y "Borrar los completados".
- RF-34: MIENTRAS no haya conexión, EL SISTEMA permitirá borrar una nota que el usuario pueda borrar según la copia.
- RF-35: MIENTRAS no haya conexión, EL SISTEMA no permitirá pasar una nota de personal a compartida ni al revés, y mostrará el motivo "Necesita conexión".
- RF-36: SI un cambio sin conexión supera los límites de notas (500 por autor) o de elementos (200 por lista) según la copia, ENTONCES EL SISTEMA no lo hará y mostrará el mismo mensaje que con conexión.
- RF-37: MIENTRAS una nota tenga cambios sin enviar, EL SISTEMA la marcará como "Pendiente de enviar" en su tarjeta y en su detalle.

### Enviar al volver la conexión

- RF-38: CUANDO vuelva la conexión con la sesión válida, EL SISTEMA enviará los cambios pendientes sin que el usuario haga nada.
- RF-39: CUANDO la app se abra con conexión y haya cambios pendientes de la misma cuenta, EL SISTEMA los enviará.
- RF-40: EL SISTEMA enviará los cambios pendientes en el orden en que se hicieron.
- RF-41: EL SISTEMA aplicará cada cambio pendiente en el servidor una sola vez, aunque el envío se corte y se repita.
- RF-42: CUANDO se envíen varios cambios sobre el mismo evento o la misma nota, EL SISTEMA dejará en el servidor el último estado que vio el usuario.
- RF-43: SI un elemento se creó y se borró sin conexión, ENTONCES EL SISTEMA no enviará nada de él.
- RF-44: CUANDO termine de enviar los cambios pendientes, EL SISTEMA avisará "N cambios sincronizados" y quitará las marcas de pendiente.
- RF-45: CUANDO termine de enviar los cambios pendientes, EL SISTEMA actualizará la copia del dispositivo y la vista con lo que haya en el servidor.
- RF-46: SI el envío de un cambio falla por la red o por un error temporal del servidor, ENTONCES EL SISTEMA lo conservará y lo reintentará más tarde sin descartarlo.
- RF-47: SI el servidor rechaza un cambio por permisos, por un calendario o nota que ya no existe para el usuario, por un límite o por datos no válidos, ENTONCES EL SISTEMA lo quitará de los pendientes, devolverá la vista al estado del servidor y lo añadirá a "Cambios no enviados" con el título, la fecha y el motivo en español.
- RF-48: MIENTRAS haya elementos en "Cambios no enviados", EL SISTEMA los mostrará en una lista accesible desde el indicador, con "Descartar" en cada uno y el contenido del cambio visible para poder copiarlo.
- RF-49: SI el envío de un cambio es rechazado, ENTONCES EL SISTEMA seguirá enviando los cambios pendientes siguientes que no dependan de él.

### Conflictos

- RF-50: SI al enviar un cambio de un evento este fue modificado por otra persona después de la copia sobre la que se hizo, ENTONCES EL SISTEMA no aplicará el cambio y preguntará al usuario mostrando las dos versiones, con "Conservar la mía" y "Conservar la suya".
- RF-51: SI al enviar un cambio de un evento este fue borrado por otra persona, ENTONCES EL SISTEMA preguntará con "Volver a crearlo" y "Descartar mi cambio".
- RF-52: SI el usuario borró sin conexión un evento que otra persona modificó después, ENTONCES EL SISTEMA preguntará con "Borrarlo igualmente" y "Conservar el suyo".
- RF-53: SI al enviar un cambio de una nota su título, cuerpo, color, fecha límite, fijada o archivada fueron modificados por otra persona después de la copia, ENTONCES EL SISTEMA preguntará como en RF-50.
- RF-54: CUANDO el usuario y otra persona hayan cambiado elementos distintos de la misma lista, EL SISTEMA aplicará los dos cambios sin preguntar.
- RF-55: SI el usuario y otra persona cambiaron el mismo elemento de una lista, ENTONCES EL SISTEMA preguntará como en RF-50.
- RF-56: MIENTRAS haya un conflicto sin resolver, EL SISTEMA seguirá enviando los demás cambios pendientes.
- RF-57: MIENTRAS haya conflictos sin resolver, EL SISTEMA los conservará aunque se cierre la app y los mostrará en el indicador hasta que el usuario los resuelva.
- RF-58: CUANDO el usuario elija "Conservar la mía", EL SISTEMA aplicará su versión en el servidor.
- RF-59: CUANDO el usuario elija "Conservar la suya" o "Descartar mi cambio", EL SISTEMA descartará su cambio y mostrará la versión del servidor.

### Sesión y privacidad

- RF-60: CUANDO el usuario cierre sesión sin cambios pendientes ni conflictos, EL SISTEMA borrará del dispositivo todos sus datos guardados.
- RF-61: CUANDO el usuario cierre sesión con cambios pendientes o conflictos, EL SISTEMA avisará "Tienes N cambios sin enviar. Si cierras sesión, se perderán." con "Cerrar sesión igualmente" y "Cancelar".
- RF-62: CUANDO el usuario confirme "Cerrar sesión igualmente", EL SISTEMA borrará del dispositivo sus datos guardados, cambios pendientes y conflictos incluidos.
- RF-63: SI la sesión caduca con cambios pendientes, ENTONCES EL SISTEMA los conservará y los enviará cuando la misma cuenta vuelva a iniciar sesión en ese dispositivo.
- RF-64: SI otra cuenta inicia sesión en un dispositivo con datos guardados de una cuenta anterior, ENTONCES EL SISTEMA borrará todos los datos de la anterior, cambios pendientes incluidos, sin enviarlos ni mostrarlos.
- RF-65: CUANDO el usuario borre su cuenta, EL SISTEMA borrará del dispositivo todos sus datos guardados.
- RF-66: EL SISTEMA no guardará en el dispositivo imágenes, comentarios, conversaciones del asistente, bloques "Ocupado" de otras personas, emails de otros miembros ni credenciales de cuentas conectadas.
- RF-67: La página `/privacy` explicará qué datos se guardan en el dispositivo, durante cuánto tiempo y cuándo se borran.

## Requisitos no funcionales

- RNF-1: Funciona en Safari de iOS (navegador y app instalada), Chrome de Android y navegadores de escritorio actuales. En iOS los cambios se envían con la app abierta; no se exige envío con la app cerrada.
- RNF-2: Abrir la app sin conexión pinta el calendario con los datos guardados en 2 segundos como mucho en un móvil de gama media (medido con la CPU ralentizada 4×).
- RNF-3: La copia de un usuario con 2.000 eventos en el rango y 500 notas ocupa 10 MB como mucho en el dispositivo.
- RNF-4: Mantener la copia al día no hace más de una lectura completa del rango al abrir la app. Un aviso de tiempo real no añade lecturas: la copia se actualiza con lo que la pantalla ya vuelve a leer (RF-5), y el resto del rango se pone al día en la lectura de RF-6 (cambio acordado con el usuario el 2026-11-17 al hacer el plan).
- RNF-5: Ningún cambio hecho sin conexión puede saltarse los permisos de la base de datos: todo se vuelve a comprobar en el servidor al enviarlo (P3).
- RNF-6: Sin dependencias nuevas ni servicios nuevos, y sin coste (P2, P6). Si el plan necesitara una, se pide aprobación aparte.
- RNF-7: Indicador, marcas de pendiente, conflictos y "Cambios no enviados" siguen la identidad Nexo y WCAG 2.2 AA, a 390, 768 y 1440 px, en claro y oscuro (P9). Ninguna marca depende solo del color.
- RNF-8: Textos en español.

## Casos límite

- La conexión va y viene en mitad de un envío: ningún cambio se aplica dos veces ni se pierde (RF-41, RF-46).
- El usuario hace un cambio sin conexión mientras se envían los anteriores: se envía después, en orden.
- El mismo evento se cambia varias veces sin conexión: solo cuenta el último estado (RF-42); si se crea y se borra, no se envía nada (RF-43).
- Se crea un evento sin conexión y después se edita o se mueve, también sin conexión: llega una sola vez, con el último estado.
- Se duplica o se pega un evento sin conexión: es un evento nuevo como cualquier otro.
- El usuario deja de ser Editor (o es expulsado) del calendario mientras está sin conexión: sus cambios se rechazan y van a "Cambios no enviados" (RF-47).
- El calendario se borra, se junta con otro o se convierte en traído mientras el usuario está sin conexión: los cambios sobre él se rechazan como en RF-47.
- La serie de una repetición cambiada sin conexión se cambia o se borra entera por otra persona: es un conflicto (RF-50, RF-51).
- Un evento cambiado sin conexión supera los límites de la app (título de más de 100 caracteres, más de 100 excepciones en la serie): se impide en el dispositivo igual que con conexión; si aun así el servidor lo rechaza, RF-47.
- Dos dispositivos de la misma cuenta cambian el mismo evento sin conexión: el segundo en enviar ve un conflicto (RF-50).
- La copia del dispositivo es de hace días: se ve igualmente, con la fecha en el indicador (RF-9).
- El navegador borra el almacenamiento del sitio (falta de espacio o limpieza del sistema): la app se comporta como si no hubiera copia (RF-12) y los cambios pendientes no enviados se pierden; se menciona en `/privacy`.
- El día cambia sin conexión: el rango no se mueve hasta que vuelve la conexión (RF-11 para lo que quede fuera).
- La zona horaria del dispositivo no es la del perfil: se usa la del perfil guardada en la copia, como con conexión.
- Un Lector sin conexión: ve todo y no puede cambiar eventos (como con conexión); sí puede ver las notas compartidas de ese calendario sin editarlas.

## Fuera de alcance

- Enviar cambios con la app cerrada (envío en segundo plano).
- Ver o cambiar fechas fuera del rango de 1 mes atrás y 3 meses adelante sin conexión.
- Cambiar series con "Este y los siguientes" o "Todos los eventos", crear series o convertir un evento en serie sin conexión.
- Escribir sin conexión en calendarios traídos de Google o iCloud.
- Imágenes y comentarios sin conexión (ni verlos ni añadirlos).
- Bloques "Ocupado" de otras personas sin conexión.
- Asistente, importar, unirse, compartir, miembros, cuentas conectadas, Ajustes, grupos y crear, editar, juntar o borrar calendarios y categorías sin conexión.
- Guardar sin conexión el orden o la visibilidad de los filtros.
- Pasar una nota de personal a compartida (o al revés) sin conexión.
- Combinar automáticamente cambios distintos sobre campos distintos del mismo evento: se pregunta (RF-50).
- Varias cuentas con datos guardados a la vez en el mismo dispositivo.
- Una opción para no guardar datos en un dispositivo concreto.
- "Guardar en otro calendario" para un evento rechazado al enviarlo.
- Iniciar sesión o registrarse sin conexión.
- Notificaciones de los cambios sincronizados a otras personas (llegan como hoy, por tiempo real).

## Criterios de finalización

- Todos los RF con su test (unitario o de integración) en verde y la verificación obligatoria completa (P8), incluido `npm run test:db` si el plan toca la base de datos.
- Recorrido manual en el iPhone (Safari y app instalada) y en escritorio: abrir con red, activar el modo avión, ver el calendario y las notas, crear, cambiar, mover y borrar eventos y notas, cerrar y volver a abrir la app sin red, recuperar la red y comprobar que todo llega al servidor y a otro usuario.
- Recorrido de conflictos con dos usuarios: los tres casos de RF-50 a RF-52 y RF-54/RF-55 en una lista.
- Prueba de cerrar sesión con cambios pendientes (RF-61 y RF-62) y de que tras cerrar sesión no queda nada del usuario en el almacenamiento del navegador.
- Medidas de RNF-2 y RNF-3 anotadas en `tasks.md`.
- Capturas a 390, 768 y 1440 px en claro y oscuro del indicador, las marcas, un conflicto y "Cambios no enviados".
- `/privacy` actualizada.
- Dependencia previa: las migraciones de la spec 028 (Notas) aplicadas en producción antes de desplegar esta spec.

## Dudas abiertas

Resueltas por el usuario el 2026-11-17:

- Opción "No guardar datos en este dispositivo" en Ajustes: **no** en esta spec; los datos se borran al cerrar sesión (queda fuera de alcance).
- Evento creado sin conexión y rechazado por el servidor: **solo se lista** en "Cambios no enviados" (RF-47, RF-48), sin "Guardar en otro calendario".
