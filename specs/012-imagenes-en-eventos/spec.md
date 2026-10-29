# Spec 012 — Imágenes en los eventos

## Contexto y objetivo

Los eventos de CaFam solo guardan texto. Las familias usan el calendario también para **recordar momentos** (un cumpleaños, un viaje, una comida), así que quieren adjuntar fotos a cada evento y volver a verlas desde el calendario. Esta spec permite adjuntar imágenes a cualquier evento, también a los de calendarios traídos de Google, y verlas en una galería. Todo dentro de la capa gratuita (P2) y con la misma privacidad que el resto de los datos del calendario (P3). Es la primera parte de la fase 3 del plan de mejoras.

## Usuarios / actores

- **Propietario y Editor del calendario**: pueden adjuntar imágenes a sus eventos y borrarlas.
- **Lector del calendario**: ve las imágenes y puede adjuntar las suyas (ver RF-4).
- **Persona ajena al calendario**: no ve nada.

## Historias de usuario

- H1: Como miembro de un calendario quiero adjuntar fotos a un evento para recordar ese momento.
- H2: Como miembro quiero ver las fotos de un evento en grande para disfrutarlas.
- H3: Como autor de una foto quiero poder borrarla si me he equivocado.
- H4: Como usuario con poco espacio de datos quiero que las fotos no pesen más de lo necesario.

## Requisitos funcionales (criterios de aceptación en EARS)

### Adjuntar

- RF-1: CUANDO un miembro que puede adjuntar abra el detalle de un evento, EL SISTEMA le ofrecerá "Añadir imágenes".
- RF-2: CUANDO el usuario elija una o varias imágenes de su dispositivo o las haga con la cámara del móvil, EL SISTEMA las adjuntará al evento.
- RF-3: EL SISTEMA aceptará imágenes JPEG, PNG, WebP y HEIC/HEIF, siempre que el navegador del usuario pueda leerlas.
- RF-4: EL SISTEMA permitirá adjuntar imágenes a cualquier miembro del calendario, incluidos los Lectores (decisión del usuario del 2026-10-29).
- RF-5: CUANDO se adjunte una imagen, EL SISTEMA la reducirá en el dispositivo del usuario a un máximo de 2048 px en el lado mayor y la guardará comprimida, quitando sus metadatos de ubicación.
- RF-6: MIENTRAS se suben imágenes, EL SISTEMA mostrará el progreso de cada una y permitirá cancelar las que no hayan terminado.
- RF-7: EL SISTEMA permitirá adjuntar imágenes también al crear un evento, desde el formulario completo, y las guardará al guardar el evento.
- RF-8: EL SISTEMA permitirá adjuntar imágenes a los eventos de calendarios traídos de Google; esas imágenes solo existen en CaFam y nunca se envían a Google.

### Ver

- RF-9: EL SISTEMA mostrará en el detalle del evento las imágenes en miniatura, en el orden en que se adjuntaron.
- RF-10: CUANDO el usuario pulse una miniatura, EL SISTEMA mostrará la imagen a pantalla completa, con imagen anterior y siguiente (botones, flechas del teclado y deslizar con el dedo) y "Cerrar" (botón y Escape).
- RF-11: EL SISTEMA mostrará en la vista completa quién subió la imagen y cuándo.
- RF-12: EL SISTEMA marcará en la agenda, y en el mes, la semana y el día cuando quepa, los eventos que tienen imágenes con un icono.
- RF-13: CUANDO el usuario pida descargar una imagen desde la vista completa, EL SISTEMA le dará la imagen guardada.
- RF-14: EL SISTEMA dará a cada imagen un texto alternativo con el título del evento y su posición ("Cumpleaños de Ana, imagen 2 de 5").

### Borrar

- RF-15: EL SISTEMA permitirá borrar una imagen a quien la subió, al propietario del calendario y a sus Editores, tras confirmarlo.
- RF-16: CUANDO se borre un evento, EL SISTEMA borrará todas sus imágenes.
- RF-17: CUANDO se borre un calendario, EL SISTEMA borrará las imágenes de todos sus eventos.
- RF-18: CUANDO una actualización desde Google borre un evento traído, EL SISTEMA borrará sus imágenes.
- RF-19: SI quien subió una imagen sale del calendario o borra su cuenta, ENTONCES EL SISTEMA conservará la imagen y mostrará como autor "un antiguo miembro" o "Cuenta borrada", igual que en los eventos (spec 006).

### Límites

- RF-20: SI el usuario intenta adjuntar más de 10 imágenes a un mismo evento, ENTONCES EL SISTEMA no adjuntará las que sobran e indicará cuántas caben.
- RF-21: SI una imagen pesa más de 20 MB antes de reducirla, ENTONCES EL SISTEMA la rechazará con un mensaje en español.
- RF-22: SI el espacio total del proyecto para imágenes llega al límite fijado para no salir de la capa gratuita, ENTONCES EL SISTEMA no aceptará imágenes nuevas y lo explicará, sin afectar a las ya guardadas.
- RF-23: SI un usuario ha subido 300 imágenes en total, ENTONCES EL SISTEMA no aceptará más imágenes suyas hasta que borre alguna (decisión del usuario del 2026-10-29).
- RF-24: SI la subida falla por la red, ENTONCES EL SISTEMA marcará esa imagen como fallida y ofrecerá "Reintentar", sin perder las demás.

### Privacidad

- RF-25: EL SISTEMA solo mostrará una imagen a los miembros del calendario de su evento, también si alguien obtiene su dirección.
- RF-26: CUANDO un miembro salga o sea expulsado del calendario, EL SISTEMA dejará de mostrarle sus imágenes en ese mismo momento.
- RF-27: EL SISTEMA no guardará las imágenes en la caché sin conexión del dispositivo (constitución, PWA).

### Otras funciones

- RF-28: CUANDO se duplique un evento, EL SISTEMA no copiará sus imágenes.
- RF-29: CUANDO se junten calendarios, EL SISTEMA conservará las imágenes de los eventos que pasan al calendario resultante.
- RF-30: CUANDO un evento se mueva a otro calendario, EL SISTEMA conservará sus imágenes, con la privacidad del calendario nuevo.
- RF-31: CUANDO un calendario sin propietario se copie para varios miembros (spec 006), EL SISTEMA copiará sus imágenes en cada copia.
- RF-32: CUANDO se suba un calendario a Google (spec 009), EL SISTEMA conservará las imágenes de sus eventos en CaFam.

## Requisitos no funcionales

- **Coste cero** (P2): todo cabe en la capa gratuita del almacenamiento; el plan fija el límite total de RF-22.
- **Privacidad** (P3): almacenamiento privado, con acceso comprobado por la base de datos y enlaces de corta duración.
- **Rendimiento**: las miniaturas del detalle cargan en menos de 2 s con 4G; las miniaturas pesan mucho menos que la imagen completa.
- **Accesibilidad** (P9): galería y vista completa usables con teclado y lector de pantalla.

## Casos límite

- **Imagen corrupta o que no es una imagen**: se rechaza con un mensaje.
- **HEIC en un navegador que no lo lee**: se rechaza con "Este navegador no puede leer esta imagen"; iOS suele entregarla ya convertida.
- **Varias personas subiendo a la vez al mismo evento**: no se pasa de 10; las que llegan tarde se rechazan.
- **Evento borrado mientras se sube**: la subida falla y no queda ninguna imagen huérfana.
- **Evento con 0 imágenes**: no se muestra la galería, solo "Añadir imágenes" a quien puede.
- **Calendario traído que deja de existir en Google** (`missing`) y se conserva: sus eventos y sus imágenes se quedan.
- **Repeticiones** (spec 013): cada repetición tiene sus propias imágenes (decisión del usuario del 2026-10-29).

## Fuera de alcance

- Vídeos, audios u otros archivos.
- Editar las imágenes (recortar, girar, filtros).
- Títulos o descripciones por imagen.
- Reordenar las imágenes.
- Fotos de perfil.
- Galería general de todos los eventos o álbumes.
- Ampliar el espacio con un servicio de pago.

## Criterios de finalización

- RF-1 a RF-32 con su test en verde, incluida la matriz de permisos del almacenamiento en `test:db`.
- Prueba manual en un móvil real (subir desde la cámara y la galería) y en escritorio.
- Capturas a 390, 768 y 1440 px en los dos temas.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna. Decidido por el usuario el 2026-10-29: los Lectores adjuntan imágenes, también en los calendarios traídos de Google, con un límite de 300 por usuario y 10 por evento.
