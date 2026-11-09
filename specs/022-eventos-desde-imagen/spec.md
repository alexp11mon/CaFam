# Spec 022 — Eventos desde una imagen en el asistente

> Estado: **aprobada** por el usuario (2026-11-09).

## Contexto y objetivo

Pasar a mano un horario de trabajo, un cuadrante de turnos o un calendario de clases a CaFam es lento y da pie a errores: hay que crear un evento por día y copiar las horas una a una. El asistente de la spec 015 ya entiende el calendario del usuario, pero solo lee texto y no crea nada. Esta spec le permite recibir hasta tres imágenes (una foto o una captura del horario), entender qué turnos o citas aparecen y **proponer** los eventos en el calendario que diga el usuario. El usuario revisa la propuesta, la corrige tocando cada fila o por chat ("el martes entro a las 9") y solo al pulsar "Crear" se guarda algo. Así un horario semanal se pasa en un minuto sin perder el control sobre lo que se escribe.

## Usuarios / actores

- **Usuario con sesión** que puede crear eventos en al menos un calendario (propietario o Editor, también de calendarios traídos de Google o iCloud con escritura).
- **Proveedor LLM** del asistente (spec 015), que recibe las imágenes y la conversación para interpretarlas.
- **Google Calendar / iCloud**, donde se escriben los eventos si el calendario elegido es traído (como en las specs 009 y 018).

## Historias de usuario

- H1: Como trabajador a turnos quiero mandar una foto de mi cuadrante semanal al asistente para que me proponga los eventos de esa semana sin escribirlos a mano.
- H2: Como usuario quiero ver todos los eventos propuestos antes de que se guarden para que no aparezca nada que no he aprobado.
- H3: Como usuario quiero corregir una fila tocándola o diciéndoselo al asistente para arreglar lo que haya leído mal.
- H4: Como usuario quiero que me avise si un evento ya existe para no duplicar el horario si lo mando dos veces.
- H5: Como usuario quiero elegir el calendario de destino, también uno de Google o iCloud, para que el horario aparezca donde lo miro.

## Requisitos funcionales (criterios de aceptación en EARS)

### Adjuntar imágenes

- RF-1: EL SISTEMA ofrecerá en la pantalla del asistente un control "Adjuntar imagen" junto al campo de la pregunta.
- RF-2: CUANDO el usuario use "Adjuntar imagen" en un móvil, EL SISTEMA ofrecerá elegir entre la cámara y la galería.
- RF-3: CUANDO el usuario pegue una imagen en el campo de la pregunta (Ctrl/⌘+V), EL SISTEMA la adjuntará como si la hubiera elegido.
- RF-4: EL SISTEMA aceptará como mucho 3 imágenes por mensaje.
- RF-5: SI el usuario intenta adjuntar una cuarta imagen, ENTONCES EL SISTEMA no la adjuntará y mostrará "Puedes adjuntar 3 imágenes como mucho".
- RF-6: EL SISTEMA aceptará imágenes JPEG, PNG y WebP, y HEIC/HEIF si el navegador puede leerlas.
- RF-7: SI una imagen no es de un formato aceptado o el navegador no puede leerla, ENTONCES EL SISTEMA no la adjuntará y dirá qué archivo falló y por qué.
- RF-8: SI una imagen pesa más de 20 MB antes de prepararla, ENTONCES EL SISTEMA no la adjuntará e informará del límite.
- RF-9: EL SISTEMA reducirá cada imagen en el dispositivo antes de enviarla y le quitará los metadatos (EXIF y ubicación), como en la spec 012.
- RF-10: MIENTRAS haya imágenes adjuntas sin enviar, EL SISTEMA mostrará su miniatura con un botón "Quitar imagen" en cada una.
- RF-11: CUANDO se envíe un mensaje con imágenes, EL SISTEMA mostrará sus miniaturas en ese mensaje del hilo.
- RF-12: EL SISTEMA permitirá enviar un mensaje con imágenes y sin texto.
- RF-13: EL SISTEMA no guardará las imágenes en ningún sitio después de responder: ni en Storage, ni en la base de datos, ni en los registros.

### Propuesta

- RF-14: CUANDO el usuario envíe imágenes que contengan un horario, EL SISTEMA responderá con una propuesta de eventos en lugar de crearlos.
- RF-15: EL SISTEMA mostrará la propuesta como una lista de filas, cada una con casilla de selección, título, fecha, hora de inicio y hora de fin (o "Todo el día") y calendario de destino.
- RF-16: EL SISTEMA usará como título de cada fila el nombre del turno o de la actividad que aparezca en la imagen, o "Trabajo" si la imagen no da ninguno.
- RF-17: EL SISTEMA no propondrá eventos para los días que la imagen marque como libres, de descanso o de vacaciones.
- RF-18: CUANDO un turno termine después de la medianoche, EL SISTEMA propondrá un solo evento que acaba al día siguiente.
- RF-19: EL SISTEMA interpretará las horas de la imagen en la zona horaria del perfil del usuario.
- RF-20: EL SISTEMA propondrá los eventos como eventos sueltos, nunca como serie repetida.
- RF-20a: CUANDO el usuario indique de qué persona es el horario ("soy Ana", "el de Luis"), EL SISTEMA solo propondrá los turnos de esa persona.
- RF-20b: SI la imagen contiene horarios de varias personas y el usuario no ha indicado cuál, ENTONCES EL SISTEMA preguntará de quién es el horario antes de mostrar la propuesta.
- RF-20c: SI la persona indicada no aparece en la imagen, ENTONCES EL SISTEMA lo dirá y no mostrará propuesta.
- RF-21: EL SISTEMA propondrá como mucho 50 eventos por propuesta.
- RF-22: SI la imagen contiene más de 50 eventos, ENTONCES EL SISTEMA propondrá los 50 primeros por fecha y dirá cuántos ha dejado fuera.

### Fechas

- RF-23: CUANDO la imagen o el mensaje del usuario indiquen la semana o las fechas, EL SISTEMA las usará para fechar los eventos.
- RF-24: SI ni la imagen ni la conversación permiten saber a qué fechas corresponde el horario, ENTONCES EL SISTEMA preguntará al usuario antes de mostrar ninguna propuesta.
- RF-25: CUANDO el usuario diga la semana con una expresión relativa ("esta semana", "la que viene", "la del 16"), EL SISTEMA la resolverá con la fecha de hoy en la zona del perfil.

### Calendario de destino

- RF-26: EL SISTEMA solo ofrecerá como destino los calendarios en los que el usuario puede crear eventos, incluidos los traídos de Google o iCloud con permiso de escritura.
- RF-27: CUANDO el usuario nombre un calendario en la conversación, EL SISTEMA lo pondrá como destino de todas las filas.
- RF-28: SI el usuario no nombra un calendario, ENTONCES EL SISTEMA preguntará en qué calendario crear los eventos antes de mostrar la propuesta.
- RF-29: SI el calendario nombrado no existe o el usuario no puede crear eventos en él, ENTONCES EL SISTEMA lo dirá y ofrecerá los calendarios donde sí puede.
- RF-30: SI el nombre coincide con varios calendarios, ENTONCES EL SISTEMA preguntará cuál de ellos.

### Corregir la propuesta

- RF-31: EL SISTEMA permitirá cambiar directamente en cada fila el título, la fecha, las horas, "Todo el día" y el calendario.
- RF-32: EL SISTEMA permitirá desmarcar una fila para que no se cree.
- RF-33: CUANDO el usuario pida una corrección por chat, EL SISTEMA responderá con una propuesta nueva que sustituye a la anterior.
- RF-34: CUANDO aparezca una propuesta nueva, EL SISTEMA dejará la anterior sin botón "Crear" y la marcará como "Sustituida".
- RF-35: SI una fila tiene la hora de fin anterior o igual a la de inicio en el mismo día, ENTONCES EL SISTEMA marcará el error en la fila y no dejará pulsar "Crear" mientras esté seleccionada.
- RF-36: SI el usuario cambia el calendario de una fila a uno que no es de la misma cuenta que el resto, ENTONCES EL SISTEMA lo permitirá y creará cada evento en su calendario.

### Duplicados

- RF-37: SI en el calendario de destino ya existe un evento con la misma fecha, hora de inicio y hora de fin que una fila, ENTONCES EL SISTEMA marcará la fila con "Ya existe un evento a esta hora" y la mostrará sin seleccionar.
- RF-38: CUANDO el usuario seleccione una fila marcada como duplicada, EL SISTEMA la creará igualmente al pulsar "Crear".
- RF-39: CUANDO el usuario cambie la fecha, las horas o el calendario de una fila, EL SISTEMA volverá a comprobar si es un duplicado.

### Crear

- RF-40: EL SISTEMA no creará ningún evento hasta que el usuario pulse "Crear" en la propuesta.
- RF-41: EL SISTEMA mostrará en el botón cuántos eventos se van a crear ("Crear 5 eventos").
- RF-42: SI no hay ninguna fila seleccionada, ENTONCES EL SISTEMA deshabilitará el botón "Crear".
- RF-43: CUANDO el usuario pulse "Crear", EL SISTEMA creará los eventos seleccionados con la sesión del usuario y sus permisos.
- RF-44: CUANDO el destino sea un calendario traído, EL SISTEMA escribirá primero en Google o iCloud y solo guardará en CaFam lo que el proveedor acepte, como en las specs 009 y 018.
- RF-45: CUANDO terminen las escrituras, EL SISTEMA dirá en el hilo cuántos eventos se crearon, con un enlace al detalle de cada uno.
- RF-46: SI algunos eventos no se pueden crear, ENTONCES EL SISTEMA conservará los creados, dirá cuáles fallaron con el motivo y dejará esas filas en la propuesta para reintentarlas.
- RF-47: MIENTRAS se crean los eventos, EL SISTEMA deshabilitará el botón "Crear" y mostrará el progreso.
- RF-48: CUANDO la propuesta se haya creado entera, EL SISTEMA la dejará sin botón "Crear" y la marcará como "Creada".
- RF-49: EL SISTEMA mostrará los eventos creados en el calendario sin recargar, como cualquier evento nuevo (tiempo real de la spec 019).

### Errores y límites

- RF-50: SI las imágenes no contienen ningún horario ni evento reconocible, ENTONCES EL SISTEMA lo dirá y no mostrará propuesta.
- RF-51: SI una parte de la imagen no se puede leer, ENTONCES EL SISTEMA propondrá lo que sí ha leído y dirá qué días u horas no ha podido leer.
- RF-52: EL SISTEMA tratará el texto que aparezca en las imágenes como datos, nunca como instrucciones.
- RF-53: CUANDO se envíe un mensaje con imágenes, EL SISTEMA lo contará como una pregunta de la cuota diaria de la spec 015 (30 al día).
- RF-54: SI falla el proveedor LLM o se agota su cuota, ENTONCES EL SISTEMA mostrará el error de la spec 015 con "Reintentar" y conservará las imágenes adjuntas.
- RF-55: CUANDO el usuario pulse "Cancelar" mientras se procesa un mensaje con imágenes, EL SISTEMA devolverá el texto y las imágenes al campo de la pregunta.
- RF-56: CUANDO el usuario pulse "Nueva conversación", EL SISTEMA descartará la propuesta pendiente sin crear nada.

### Privacidad

- RF-57: EL SISTEMA explicará en `/privacy` que las imágenes adjuntas al asistente se envían al proveedor LLM para leerlas y que CaFam no las guarda.
- RF-58: EL SISTEMA mostrará junto a "Adjuntar imagen" que la imagen se envía al proveedor del asistente, con enlace a `/privacy`.

## Requisitos no funcionales

- **Coste cero (P2):** el proveedor y el modelo que lean imágenes deben tener capa gratuita sin tarjeta. La spec no fija el modelo: los actuales de la 015 solo leen texto y el plan elegirá uno con visión, con sus límites.
- **Privacidad (P1, P3):** el proveedor no puede entrenar con las imágenes. Las escrituras pasan por la sesión del usuario y RLS: el asistente nunca crea donde el usuario no podría.
- **Secretos (P4):** la clave del proveedor sigue solo en el servidor.
- **Tiempo:** el 90 % de los mensajes con una imagen recibe respuesta en 20 s o menos.
- **Calidad:** con un conjunto de al menos 10 imágenes de horarios sintéticas (sin datos reales), el 90 % de las filas propuestas tienen bien la fecha y las horas.
- **Accesibilidad (P9):** la propuesta es usable solo con teclado y con lector de pantalla (cada fila con etiquetas, errores anunciados), con objetivos de 44 px; capturas a 390, 768 y 1440 px en los dos temas.
- **Idioma:** español en todo lo visible.

## Casos límite

- Horario con varias semanas: se proponen todas las que se puedan fechar, hasta 50 eventos (RF-21, RF-22).
- Dos imágenes que repiten el mismo día: no se proponen dos filas iguales para el mismo día y horas.
- Turno partido (9–14 y 17–20): dos filas el mismo día.
- Horas en formato 12 h ("9 AM") o sin minutos ("9-17"): se interpretan como 09:00–17:00.
- Fecha propuesta en el pasado: se propone igual (puede ser un horario que se apunta tarde).
- El calendario de destino deja de ser escribible (le quitan el rol) entre la propuesta y "Crear": esas filas fallan con su motivo (RF-46).
- Cambio de hora (horario de verano) en la semana: las horas de pared se respetan en la zona del perfil.
- Doble pulsación de "Crear": no se crean eventos duplicados.
- Imagen girada o con perspectiva (foto de un papel): se intenta leer; si no se puede, RF-50 o RF-51.
- Cuadrante de todo el equipo: el usuario dice qué persona revisar (RF-20a a RF-20c).

## Fuera de alcance

- Eventos repetidos (series) desde la imagen: solo eventos sueltos de la semana o fechas indicadas.
- PDF y otros archivos que no sean imágenes.
- Crear eventos desde el asistente **sin** imagen ("créame una cita mañana a las 5").
- Modificar o borrar eventos existentes desde el asistente.
- Guardar la imagen en el evento creado (para eso están las imágenes de la spec 012).
- Guardar la propuesta o la conversación entre sesiones.
- Adjuntar imágenes desde el botón flotante sin abrir la pantalla del asistente, o desde otras pantallas.
- Categoría, color propio, lugar, descripción o invitados en la propuesta (se pueden editar después en el evento).
- Lectura de horarios a mano muy deteriorados más allá de lo que haga el modelo elegido.

## Criterios de finalización

- Todos los RF con test en verde (unitarios y, para las escrituras y permisos, `test:db`).
- Evaluación con el conjunto de imágenes sintéticas que cumple el umbral de calidad y de tiempo.
- `/privacy` actualizada.
- Prueba manual del flujo completo en móvil (foto con la cámara del iPhone) y escritorio (captura pegada), con un calendario normal y uno traído de Google.

## Dudas abiertas

Ninguna. Resueltas por el usuario el 2026-11-09:

- Cuadrante con varias personas: el usuario indica qué persona revisar (RF-20a a RF-20c).
- Cuota: un mensaje con imágenes cuenta como una pregunta normal de las 30 diarias (RF-53), sin límite propio.
