# Spec 013 — Eventos recurrentes

## Contexto y objetivo

En CaFam cada evento ocurre una sola vez. Para un cumpleaños, la extraescolar de los martes o el recibo de cada día 5 hay que crear un evento por fecha, y la importación `.ics` convierte cada repetición en un evento suelto (spec 004). Esta spec añade **eventos que se repiten**, con una configuración tan completa como la de Google Calendar: frecuencias, intervalos, días de la semana, "el segundo martes", fin por fecha o por número de veces. También permite cambiar o borrar una sola repetición, las siguientes o toda la serie. Es la segunda parte de la fase 3 del plan de mejoras.

## Usuarios / actores

- **Propietario y Editor del calendario**: crean, cambian y borran series.
- **Lector**: ve las repeticiones como cualquier otro evento.

## Historias de usuario

- H1: Como usuario quiero crear un evento que se repita para no tener que crearlo en cada fecha.
- H2: Como usuario quiero elegir rápidamente las repeticiones más habituales ("cada semana el martes", "cada año") para no configurar nada.
- H3: Como usuario quiero una regla personalizada para casos como "cada 2 semanas el lunes y el jueves" o "el último viernes de cada mes".
- H4: Como usuario quiero cambiar o cancelar una sola repetición (este martes no hay clase) sin tocar las demás.
- H5: Como usuario quiero cambiar una serie desde una fecha en adelante (desde enero, la clase pasa a las 18:00).

## Requisitos funcionales (criterios de aceptación en EARS)

### Crear una serie

- RF-1: EL SISTEMA ofrecerá en el formulario de evento un campo "Repetir" con "No se repite" como valor por defecto.
- RF-2: EL SISTEMA ofrecerá en "Repetir" estas opciones rápidas, calculadas a partir de la fecha de inicio: "Cada día", "Cada semana el <día>", "Cada mes el día <n>", "Cada mes el <n.º> <día>" (p. ej. "el 2.º martes"), "Cada mes el último <día>" (solo si la fecha es la última de ese día en el mes), "Cada año el <día> de <mes>", "Todos los días laborables (lunes a viernes)" y "Personalizado…".
- RF-3: CUANDO el usuario elija "Personalizado…", EL SISTEMA le dejará configurar: repetir cada N días, semanas, meses o años (N de 1 a 99); en semanas, uno o varios días de la semana; en meses, por día del mes o por posición del día de la semana (1.º, 2.º, 3.º, 4.º o último); y el final.
- RF-4: EL SISTEMA ofrecerá tres finales para una serie: "Nunca", "El <fecha>" (incluida) y "Tras <n> repeticiones" (de 1 a 999).
- RF-5: EL SISTEMA mostrará un resumen en español de la regla elegida mientras se configura ("Cada 2 semanas el lunes y el jueves, 10 veces").
- RF-6: EL SISTEMA permitirá series en eventos con hora, de día completo y de varios días.
- RF-7: EL SISTEMA ofrecerá "Repetir" también en la ventana rápida (spec 008) a través de "Más opciones".
- RF-8: SI la regla no produce ninguna repetición (p. ej. fin anterior al inicio), ENTONCES EL SISTEMA no guardará la serie y lo explicará.

### Mostrar

- RF-9: EL SISTEMA mostrará cada repetición en las vistas agenda, mes, semana y día, en el mini calendario y en "Próximo evento", igual que un evento suelto.
- RF-10: EL SISTEMA marcará las repeticiones con un icono de repetición en las vistas donde quepa y con el resumen de la regla en el detalle.
- RF-11: EL SISTEMA mostrará las repeticiones de una serie sin fin en cualquier fecha futura que el usuario visite.
- RF-12: MIENTRAS una serie de eventos con hora cruce un cambio de horario de verano, EL SISTEMA conservará la hora de reloj de la zona del perfil de quien creó la serie (las 18:00 siguen siendo las 18:00).
- RF-13: SI una repetición mensual cae en un día que no existe en ese mes (p. ej. el día 31), ENTONCES EL SISTEMA omitirá ese mes, como Google Calendar.
- RF-14: EL SISTEMA mostrará los eventos de día completo repetidos el mismo día del calendario para todos los lectores, sin convertir de zona (convención de la spec 002).

### Cambiar y borrar

- RF-15: CUANDO el usuario guarde cambios en una repetición, EL SISTEMA le preguntará si se aplican a "Solo este evento", a "Este y los siguientes" o a "Todos los eventos".
- RF-16: CUANDO el usuario elija "Solo este evento", EL SISTEMA cambiará solo esa repetición y la mostrará como excepción de la serie.
- RF-17: CUANDO el usuario elija "Este y los siguientes", EL SISTEMA terminará la serie original antes de esa repetición y creará una serie nueva desde ella con los cambios.
- RF-18: CUANDO el usuario elija "Todos los eventos", EL SISTEMA aplicará los cambios a toda la serie y conservará las excepciones que no contradigan el cambio.
- RF-19: SI el cambio de "Todos los eventos" modifica la regla o la fecha de inicio, ENTONCES EL SISTEMA descartará las excepciones de la serie y avisará antes de guardar de cuántas se pierden.
- RF-20: CUANDO el usuario borre una repetición, EL SISTEMA le preguntará si borra "Solo este evento", "Este y los siguientes" o "Todos los eventos", y lo aplicará.
- RF-21: EL SISTEMA permitirá convertir un evento suelto en una serie y una serie en un evento suelto (elegir "No se repite" en "Todos los eventos" deja solo la primera repetición).
- RF-22: CUANDO se duplique una repetición, EL SISTEMA creará un evento suelto con la fecha de esa repetición.
- RF-23: CUANDO se mueva una serie a otro calendario, EL SISTEMA moverá toda la serie con sus excepciones.

### Otras funciones

- RF-24: EL SISTEMA guardará las imágenes (spec 012) y los comentarios (spec 014) de cada repetición por separado: el cumpleaños de 2026 tiene sus fotos y comentarios y el de 2027 los suyos (decisión del usuario del 2026-10-29).
- RF-24b: SI se borran repeticiones o se cambia la regla de forma que una repetición con imágenes o comentarios desaparece, ENTONCES EL SISTEMA avisará antes de guardar de cuántas imágenes y comentarios se perderán.
- RF-25: CUANDO se junten calendarios, EL SISTEMA conservará las series y sus excepciones.
- RF-26: CUANDO un calendario sin propietario se copie (spec 006), EL SISTEMA copiará las series y sus excepciones.
- RF-27: EL SISTEMA seguirá importando las repeticiones de un `.ics` como eventos sueltos (spec 004), sin cambios.

### Calendarios traídos de Google

- RF-28: EL SISTEMA seguirá mostrando las series de Google como repeticiones sueltas, tocadas una a una (spec 009), sin cambios.
- RF-29: MIENTRAS el calendario sea traído de Google, EL SISTEMA no ofrecerá "Repetir" al crear o cambiar sus eventos, y lo explicará.
- RF-30: SI el usuario sube a Google (spec 009) un calendario con series, ENTONCES EL SISTEMA subirá cada repetición dentro de la ventana de sincronización como evento suelto y avisará antes de ello.

### Límites

- RF-31: EL SISTEMA permitirá como mucho 500 series por calendario.
- RF-32: SI una serie tiene más de 100 excepciones, ENTONCES EL SISTEMA no guardará excepciones nuevas y propondrá "Este y los siguientes".

## Requisitos no funcionales

- **Rendimiento**: abrir cualquier vista con 50 series activas no tarda más que hoy con el mismo número de eventos sueltos, con un margen de 300 ms.
- **Privacidad** (P3): las series y sus excepciones tienen los mismos permisos que los eventos.
- **Sin dependencias nuevas**: la constitución permite reutilizar la ya aprobada para reglas de repetición.
- **Accesibilidad** (P9): la configuración personalizada se usa entera con teclado y lector de pantalla.

## Casos límite

- **29 de febrero cada año**: solo aparece en los años bisiestos (como RF-13).
- **Inicio que no coincide con la regla** (empieza un miércoles con "cada lunes"): la primera repetición es el lunes siguiente.
- **Repetición cambiada a otra fecha**: se muestra en la fecha nueva y no en la original.
- **Repetición cambiada de día que choca con otra de la misma serie**: se muestran las dos.
- **Serie que empieza antes del rango visible**: sus repeticiones dentro del rango se muestran.
- **Editor que pierde el rol a mitad de un cambio**: la base de datos lo rechaza y se informa.
- **Dos personas cambiando la misma serie a la vez**: gana el último cambio guardado.
- **Eventos de varios días repetidos** que se solapan entre sí (p. ej. 3 días cada 2 días): se muestran todos.

## Fuera de alcance

- Crear o cambiar series en los calendarios traídos de Google (se escribirían como serie en Google).
- Reglas basadas en "días hábiles" con festivos, fechas sueltas añadidas a mano (RDATE) o reglas combinadas.
- Recordatorios o notificaciones de las repeticiones.
- Exportar a `.ics`.
- Convertir en series los eventos sueltos ya importados.

## Criterios de finalización

- RF-1 a RF-32 con su test en verde, con casos de horario de verano, fin de mes, bisiestos y excepciones.
- Prueba manual de crear, cambiar y borrar cada tipo de regla en móvil y escritorio.
- Capturas a 390, 768 y 1440 px en los dos temas.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna. Decidido por el usuario el 2026-10-29: imágenes y comentarios por repetición.
