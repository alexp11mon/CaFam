# Spec 017 — Mover y redimensionar eventos, menú contextual y gestos

## Contexto y objetivo

Con la spec 016, CaFam ya se ve como Google Calendar, pero se maneja peor que Google. Para cambiar la hora de un evento hay que abrirlo, editarlo y guardar. Google, en cambio, deja **arrastrarlo** con el ratón o, en el móvil, manteniéndolo pulsado. En el ordenador, el **clic derecho** abre un menú para cambiarle el color al momento. El usuario lo pidió al revisar la 016 (2026-10-30). Esta spec añade esas dos funciones, más cuatro mejoras de interacción que el usuario eligió tras investigar Google Calendar y las capacidades de una PWA:

- el detalle del evento en una hoja inferior en el móvil;
- pellizcar para ampliar las horas;
- "Deshacer" en los avisos;
- más atajos de teclado, con su ayuda.

Se hace después de la 016 y antes de la 013.

## Usuarios / actores

- **Propietario o Editor** de un calendario: mueve, redimensiona, cambia el color, duplica y borra sus eventos.
- **Propietario o Editor de un calendario traído de Google con escritura** (spec 009): igual, y el cambio se escribe en Google.
- **Lector**, o miembro de un calendario de solo lectura: ve los eventos, pero no puede moverlos ni abrir el menú.

## Historias de usuario

- H1: Como usuario quiero cambiar la hora o el día de un evento arrastrándolo, para no tener que abrir el formulario.
- H2: Como usuario quiero alargar o acortar un evento tirando de su borde.
- H3: Como usuario del ordenador quiero cambiar el color de un evento con el clic derecho.
- H4: Como usuario quiero deshacer un movimiento o un borrado hecho sin querer.
- H5: Como usuario del móvil quiero ver el detalle de un evento sin perder de vista el calendario.
- H6: Como usuario quiero ampliar las horas para ver mejor un día cargado.
- H7: Como usuario del ordenador quiero manejar el calendario solo con el teclado.

## Requisitos funcionales (criterios de aceptación en EARS)

### Permisos (todo lo que escribe)

- RF-1: EL SISTEMA solo permitirá mover, redimensionar, cambiar el color, pegar o borrar eventos a quien pueda editarlos según las reglas actuales (propietario o Editor, y en los calendarios traídos solo con escritura en Google).
- RF-2: SI el usuario no puede editar un evento, ENTONCES EL SISTEMA no iniciará el arrastre al intentarlo y abrirá su detalle como al pulsarlo.
- RF-3: CUANDO un cambio afecte a un evento de un calendario traído, EL SISTEMA lo escribirá primero en Google y solo después en CaFam, como en la spec 009.
- RF-4: SI Google o la base de datos rechazan el cambio, ENTONCES EL SISTEMA devolverá el evento a su sitio anterior y mostrará un aviso con el motivo.

### Mover y redimensionar en semana y día

- RF-5: CUANDO el usuario arrastre con el ratón un evento con hora, EL SISTEMA lo moverá siguiendo el puntero en pasos de 15 minutos y conservará su duración.
- RF-6: CUANDO el usuario mantenga pulsado un evento con hora durante 500 ms en una pantalla táctil, EL SISTEMA lo marcará como levantado y lo moverá al deslizar el dedo, en pasos de 15 minutos.
- RF-7: MIENTRAS se arrastra un evento en la vista semana, EL SISTEMA permitirá llevarlo a otro día de la semana visible.
- RF-8: MIENTRAS se arrastra un evento, EL SISTEMA mostrará su hora de inicio y de fin en el propio bloque.
- RF-9: MIENTRAS se arrastra un evento cerca del borde superior o inferior de la rejilla, EL SISTEMA desplazará la rejilla en ese sentido.
- RF-10: CUANDO el usuario arrastre con el ratón el borde inferior de un evento con hora, EL SISTEMA cambiará su hora de fin en pasos de 15 minutos sin cambiar el inicio.
- RF-11: MIENTRAS un evento esté levantado en una pantalla táctil, EL SISTEMA mostrará un tirador en su borde inferior para cambiar la hora de fin.
- RF-12: SI el usuario intenta dejar una duración menor de 15 minutos, ENTONCES EL SISTEMA la dejará en 15 minutos.
- RF-13: CUANDO el usuario arrastre un evento con hora a la franja de día completo, EL SISTEMA lo convertirá en un evento de día completo de ese día.
- RF-14: CUANDO el usuario arrastre un evento de día completo de un solo día a la rejilla horaria, EL SISTEMA lo convertirá en un evento con hora de 1 h que empieza donde se suelta.
- RF-15: CUANDO el usuario arrastre un evento de día completo dentro de la franja de día completo de la semana, EL SISTEMA lo moverá de día y conservará cuántos días dura.

### Mover en la vista mes

- RF-16: CUANDO el usuario arrastre un evento a otro día de la vista mes (con el ratón, o en táctil tras mantenerlo pulsado 500 ms), EL SISTEMA lo moverá a ese día y conservará su hora y su duración.
- RF-17: CUANDO el usuario arrastre un evento de varios días en la vista mes, EL SISTEMA moverá su primer día al día donde se suelte y conservará cuántos días dura.

### Al soltar y durante el arrastre

- RF-18: CUANDO el usuario suelte un evento movido o redimensionado, EL SISTEMA guardará el cambio sin pedir confirmación.
- RF-19: SI el usuario suelta el evento en el mismo sitio, ENTONCES EL SISTEMA no guardará nada.
- RF-20: CUANDO el usuario pulse Escape durante un arrastre con el ratón, EL SISTEMA lo cancelará y devolverá el evento a su sitio.
- RF-21: MIENTRAS haya un arrastre en curso, EL SISTEMA no cambiará de periodo al deslizar (spec 016) ni abrirá la ventana rápida.
- RF-22: SI el usuario mueve el dedo antes de los 500 ms, ENTONCES EL SISTEMA lo tratará como desplazamiento o deslizamiento, no como arrastre.
- RF-23: EL SISTEMA mantendrá el arrastre sobre un hueco vacío para crear (spec 008) sin cambios: arrastrar sobre un evento lo mueve; sobre un hueco, crea.

### Deshacer

- RF-24: CUANDO se guarde un movimiento, un cambio de duración o un cambio de color, EL SISTEMA mostrará un aviso que lo describe ("Evento movido", "Duración cambiada" o "Color cambiado") con el botón "Deshacer".
- RF-25: CUANDO se borre un evento, EL SISTEMA mostrará el aviso "Evento borrado" con el botón "Deshacer".
- RF-26: EL SISTEMA mantendrá visible el botón "Deshacer" durante 10 segundos.
- RF-27: CUANDO el usuario pulse "Deshacer" tras un movimiento, un cambio de duración o de color, EL SISTEMA devolverá el evento a como estaba.
- RF-28: CUANDO el usuario pulse "Deshacer" tras un borrado, EL SISTEMA recuperará el evento con todos sus datos, sus imágenes, su autor y su calendario.
- RF-29: SI la acción no se puede deshacer porque el evento cambió entretanto o Google lo rechaza, ENTONCES EL SISTEMA no lo deshará y mostrará un aviso con el motivo.
- RF-30: EL SISTEMA solo permitirá deshacer la última acción.
- RF-31: CUANDO se borre un solo evento, EL SISTEMA no pedirá confirmación, porque se puede deshacer.

### Menú contextual (solo con ratón o teclado)

- RF-32: CUANDO el usuario haga clic derecho sobre un evento que puede editar, EL SISTEMA abrirá junto al puntero un menú propio en lugar del del navegador.
- RF-33: CUANDO el usuario pulse la tecla de menú contextual o Mayús+F10 con un evento enfocado, EL SISTEMA abrirá el mismo menú junto al evento.
- RF-34: EL SISTEMA mostrará en el menú los colores de la paleta pastel, la opción "Color del calendario" y, debajo, "Duplicar" y "Borrar".
- RF-35: EL SISTEMA marcará en el menú el color actual del evento con algo más que el color (una marca de selección).
- RF-36: CUANDO el usuario elija un color en el menú, EL SISTEMA lo aplicará al evento y cerrará el menú.
- RF-37: CUANDO el usuario elija "Color del calendario", EL SISTEMA quitará el color propio del evento.
- RF-38: CUANDO el evento sea de un calendario traído, EL SISTEMA guardará su color solo en CaFam, sin enviarlo a Google (spec 009 RF-16).
- RF-39: CUANDO el usuario elija "Duplicar", EL SISTEMA abrirá el alta con los datos del evento, como el "Duplicar" actual.
- RF-40: CUANDO el usuario elija "Borrar", EL SISTEMA borrará el evento con "Deshacer" (RF-25).
- RF-41: SI el usuario no puede editar el evento, ENTONCES EL SISTEMA mostrará el menú del navegador.
- RF-42: EL SISTEMA permitirá recorrer el menú con las flechas, elegir con Intro y cerrarlo con Escape o pulsando fuera.
- RF-43: MIENTRAS la pantalla solo tenga entrada táctil, EL SISTEMA no ofrecerá el menú contextual.

### Detalle en hoja inferior (móvil)

- RF-44: MIENTRAS la anchura sea de 768 px o menos, CUANDO el usuario pulse un evento, EL SISTEMA abrirá su detalle en una hoja que sube desde abajo hasta media pantalla, con el calendario visible detrás.
- RF-45: CUANDO el usuario deslice la hoja hacia arriba, EL SISTEMA la ampliará a pantalla completa.
- RF-46: CUANDO el usuario deslice la hoja hacia abajo desde media pantalla, o pulse fuera de ella, EL SISTEMA la cerrará.
- RF-47: CUANDO el usuario pulse "Editar" en la hoja, EL SISTEMA abrirá la edición a pantalla completa, como hoy.
- RF-48: EL SISTEMA mantendrá en la hoja todo lo que muestra hoy el detalle (botones, imágenes, autor) y el comportamiento de cerrar con cambios sin guardar (spec 008).

### Pellizcar para ampliar (semana y día)

- RF-49: CUANDO el usuario pellizque con dos dedos sobre la rejilla horaria, EL SISTEMA cambiará la altura de las horas siguiendo el gesto.
- RF-50: CUANDO el usuario use Ctrl + rueda del ratón sobre la rejilla horaria, EL SISTEMA cambiará la altura de las horas.
- RF-51: EL SISTEMA limitará la altura de una hora a entre la mitad y el triple de la altura por defecto.
- RF-52: MIENTRAS cambia la altura, EL SISTEMA mantendrá fija en pantalla la hora que estaba bajo los dedos o el puntero.
- RF-53: EL SISTEMA recordará la altura elegida en ese dispositivo.

### Atajos de teclado (ordenador)

- RF-54: CUANDO el usuario pulse E con la ventana de detalle de un evento abierta, EL SISTEMA abrirá su edición.
- RF-55: CUANDO el usuario pulse Supr o Retroceso con un evento enfocado o su detalle abierto, EL SISTEMA lo borrará con "Deshacer".
- RF-56: CUANDO el usuario pulse G, EL SISTEMA abrirá un diálogo para escribir una fecha y llevará la vista actual a ella.
- RF-57: CUANDO el usuario pulse Ctrl+C (o Cmd+C) con un evento enfocado o su detalle abierto, EL SISTEMA lo copiará y lo avisará con "Evento copiado".
- RF-58: CUANDO el usuario pulse Ctrl+V (o Cmd+V) con un evento copiado, EL SISTEMA creará una copia en el último día o franja que el usuario haya pulsado o enfocado, con la misma hora, duración y calendario, y mostrará "Evento pegado" con "Deshacer".
- RF-59: SI no hay un día o franja seleccionados al pegar, ENTONCES EL SISTEMA pegará el evento en la fecha de la vista, a su misma hora.
- RF-60: SI el usuario no puede crear eventos en el calendario del evento copiado, ENTONCES EL SISTEMA no lo pegará y mostrará el motivo.
- RF-61: EL SISTEMA no copiará las imágenes al pegar, como al duplicar (spec 012).
- RF-62: CUANDO el usuario pulse ?, EL SISTEMA abrirá un diálogo con la lista de todos los atajos.
- RF-63: EL SISTEMA aplicará a los atajos nuevos las reglas actuales: nunca mientras se escribe ni con otra ventana abierta (salvo E, Supr y Ctrl+C en el detalle).
- RF-64: EL SISTEMA permitirá enfocar los eventos de las vistas con Tab y moverlos con el teclado: Alt + flechas arriba y abajo cambia la hora 15 minutos; Alt + flechas izquierda y derecha cambia el día.

## Requisitos no funcionales

- **Constitución:** hace falta la enmienda 5 de P9, que:
  - permite "Deshacer" en los avisos;
  - abre el detalle en el móvil en una hoja inferior (hoy, "a pantalla completa en el móvil");
  - saca mover y redimensionar arrastrando de "fuera de alcance".
- **Sin dependencias nuevas** (P6): arrastre, pellizco, menú y hoja con eventos de puntero y APIs del navegador.
- **Accesibilidad** (P9): todo lo que se hace arrastrando se puede hacer también con el teclado (RF-64) o desde el formulario. Lo mismo vale para el menú contextual. Mientras se arrastra, se anuncia la nueva hora a los lectores de pantalla. El menú tiene el rol y los nombres accesibles correctos.
- **Rendimiento:** el bloque sigue al dedo o al puntero a 60 fps en un móvil de gama media. La red solo se usa al soltar.
- **Movimiento:** el evento levantado y la hoja se animan con los tokens de la spec 011 y respetan `prefers-reduced-motion`.

## Casos límite

- **Soltar fuera de la vista** (fuera de la rejilla o del mes): se cancela y el evento vuelve a su sitio.
- **Evento de varios días con hora** en semana: se mueve entero y conserva su duración.
- **Evento que cruza la medianoche**: al redimensionar en el día de inicio solo cambia el fin si cae en ese día. Su parte del día siguiente no se puede redimensionar.
- **Evento traído de un calendario que Google solo deja leer**, o sin escritura: no se levanta (RF-2).
- **Dos personas mueven el mismo evento**: gana la última que guarda. "Deshacer" de la primera falla con aviso si el evento cambió (RF-29).
- **Deshacer un borrado tras cerrar la app** o pasados los 10 segundos: ya no se puede.
- **Deshacer un borrado en un calendario traído**: el evento se vuelve a crear en Google como evento nuevo. Las repeticiones se tratan una a una, como en la 009.
- **Borrar un evento que forma parte de una repetición** (cuando exista la spec 013): esta spec no lo cubre. La 013 decide.
- **Arrastrar a una hora que no existe por el cambio de hora** (marzo): se coloca en la primera hora válida.
- **Pellizco sobre un evento**: amplía, no lo levanta.
- **Ctrl+C con texto seleccionado**: copia el texto, no el evento.
- **Ventana rápida abierta** al pulsar un atajo: los atajos no actúan (regla actual).

## Fuera de alcance

- Arrastrar un evento a otro periodo (más allá de la semana o el mes visibles) o a otro calendario.
- Menú contextual en pantallas táctiles.
- Seleccionar varios eventos a la vez.
- Deshacer más de una acción, o deshacer crear y editar desde el formulario.
- Mover o redimensionar en la vista agenda.
- Vibración al levantar un evento.
- Las mejoras grandes que pasan a la hoja de ruta con su propia spec: recordatorios con notificaciones push, búsqueda de eventos, compartir e integración con el sistema (compartir un evento, recibir `.ics` o fotos, accesos directos y número en el icono) y alta en lenguaje natural.

## Criterios de finalización

- RF-1 a RF-64 con su test o comprobación manual en verde.
- Enmienda 5 de la constitución aprobada.
- Prueba en un iPhone real (o su emulación táctil) de mantener pulsado, arrastrar, redimensionar, la hoja inferior y el pellizco, y en el escritorio del ratón, el menú y los atajos.
- Prueba con un calendario traído de Google: mover, redimensionar, cambiar el color, borrar y deshacer.
- Verificación obligatoria completa (P8) con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna bloqueante. Decisiones tomadas por defecto que el usuario puede cambiar al aprobar:
  - Borrar un evento ya no pide confirmación, porque se puede deshacer (RF-31). Juntar calendarios, borrar calendarios y borrar imágenes la siguen pidiendo.
  - "Deshacer" dura 10 segundos y solo deshace la última acción.
  - Mantener pulsado 500 ms para levantar un evento.
  - Pegar usa el último día o franja pulsado o enfocado (RF-58).
