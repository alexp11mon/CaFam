# Spec 011 — Rediseño visual: modo oscuro, transparencias y movimiento

## Contexto y objetivo

La identidad visual de la spec 005 es sobria y plana: un solo tema claro, sin transparencias y con el movimiento reducido al mínimo. El usuario quiere un estilo más moderno: poder usar la app en **modo oscuro**, que los contenedores principales tengan **transparencia con desenfoque** (glassmorphism) y que la app **responda con movimiento**. Eso incluye botones que reaccionan al pulsarlos y transiciones suaves al cambiar de vista, de periodo o de calendario. La enmienda 3 de la constitución (2026-10-29) lo permite siempre que se cumpla la accesibilidad de P9 en los dos temas. Es la fase 2 del plan de mejoras.

## Usuarios / actores

- **Usuario con sesión**: elige el tema y ve las transparencias y animaciones en todas las pantallas.
- **Visitante sin sesión**: ve la portada, el login, el registro, la política de privacidad, las invitaciones y la pantalla sin conexión.
- **Usuario con movimiento reducido**: tiene activada la preferencia del sistema `prefers-reduced-motion`.

## Historias de usuario

- H1: Como usuario quiero usar la app en modo oscuro para verla cómodamente de noche.
- H2: Como usuario quiero que la app siga el tema de mi sistema para no tener que cambiarlo a mano.
- H3: Como usuario quiero que mi elección de tema me acompañe en todos mis dispositivos.
- H4: Como usuario quiero que los botones y las vistas respondan con movimiento para que la app se sienta viva y para entender qué ha cambiado.
- H5: Como usuario sensible al movimiento quiero que la app respete mi preferencia del sistema para no marearme.

## Requisitos funcionales (criterios de aceptación en EARS)

### Tema claro y oscuro

- RF-1: EL SISTEMA ofrecerá en Ajustes tres opciones de tema: "Claro", "Oscuro" y "Como el sistema".
- RF-2: EL SISTEMA aplicará "Como el sistema" a los usuarios que nunca hayan elegido tema.
- RF-3: CUANDO el usuario elija un tema, EL SISTEMA lo aplicará en el momento a toda la interfaz, sin recargar la página.
- RF-4: CUANDO el usuario elija un tema, EL SISTEMA lo guardará en su cuenta y lo aplicará en cualquier otro dispositivo donde inicie sesión.
- RF-5: MIENTRAS el tema sea "Como el sistema", CUANDO el sistema operativo cambie entre claro y oscuro, EL SISTEMA cambiará de tema sin recargar.
- RF-6: EL SISTEMA ofrecerá, además de Ajustes, un acceso directo para alternar entre claro y oscuro desde el marco de la app (barra lateral en escritorio y hoja "Más" en el móvil).
- RF-7: EL SISTEMA pintará cada página con el tema correcto desde el primer fotograma, sin un destello del tema contrario al cargar.
- RF-8: MIENTRAS no haya sesión, EL SISTEMA aplicará el tema del sistema operativo.
- RF-9: EL SISTEMA mantendrá los seis colores de acento en los dos temas, con su contraste comprobado en cada uno (P9).
- RF-10: EL SISTEMA mantendrá los colores pastel de los calendarios en los dos temas, con el texto que va encima en tinta oscura.
- RF-11: EL SISTEMA aplicará el tema elegido a la barra de estado y al color del tema de la app instalada, donde el navegador lo permita.

### Transparencias

- RF-12: EL SISTEMA pintará como superficies translúcidas con desenfoque de fondo la barra lateral, la barra inferior, los paneles del calendario, la ventana de evento, la ventana rápida, la hoja "Más", los diálogos y los avisos.
- RF-13: EL SISTEMA mostrará un fondo de pantalla con un degradado suave propio de cada tema, de modo que la transparencia se perciba.
- RF-14: SI el navegador no admite desenfoque de fondo, ENTONCES EL SISTEMA pintará esas superficies opacas, con el mismo aspecto de color.
- RF-15: EL SISTEMA mantendrá sobre cualquier superficie translúcida un contraste de texto de al menos 4,5:1 frente al fondo más desfavorable que pueda quedar detrás.

### Movimiento y microinteracciones

- RF-16: CUANDO el usuario pase el puntero por encima de un botón o un control, o lo pulse, EL SISTEMA lo animará con una respuesta breve de escala o elevación.
- RF-17: CUANDO el usuario cambie de vista (agenda, mes, semana, día), EL SISTEMA hará una transición entre la vista anterior y la nueva.
- RF-18: CUANDO el usuario avance o retroceda de periodo (anterior, siguiente, hoy), EL SISTEMA desplazará el contenido en el sentido del cambio.
- RF-19: CUANDO el usuario muestre u oculte un calendario, un grupo o una persona en los filtros, EL SISTEMA hará aparecer o desaparecer sus eventos con un fundido.
- RF-20: CUANDO se abra o se cierre la ventana de evento, la ventana rápida, la hoja "Más", un diálogo o un aviso, EL SISTEMA lo animará al entrar y al salir.
- RF-21: CUANDO el usuario cambie de tema, EL SISTEMA hará la transición entre los dos temas con un fundido.
- RF-22: EL SISTEMA limitará cada animación a 400 ms como máximo.
- RF-23: MIENTRAS el sistema operativo pida movimiento reducido, EL SISTEMA sustituirá los desplazamientos, escalas y elevaciones por un cambio inmediato o un fundido.
- RF-24: SI el navegador no admite las transiciones entre vistas, ENTONCES EL SISTEMA cambiará de vista sin animación y sin perder ninguna función.
- RF-25: MIENTRAS una animación esté en curso, EL SISTEMA aceptará las pulsaciones y los atajos de teclado del usuario sin esperar a que termine.

### Alcance de pantallas

- RF-26: EL SISTEMA aplicará el tema, las transparencias y el movimiento a todas las pantallas existentes: portada, login, registro, recuperación de contraseña, invitación, sin conexión, política de privacidad y todas las del panel.

## Requisitos no funcionales

- **Accesibilidad** (P9): WCAG 2.2 AA en los dos temas, foco visible sobre cristal, objetivos táctiles de 44 px y todo usable con teclado.
- **Rendimiento**: las animaciones no bajan de 60 fotogramas por segundo en un móvil de gama media; el desenfoque no se aplica a superficies que se desplazan con el contenido si eso lo impide.
- **Sin dependencias nuevas** (constitución): solo CSS y APIs nativas del navegador.
- **Coherencia**: los colores, sombras, desenfoques y degradados son tokens; la guardia de diseño lo comprueba.

## Casos límite

- **Elección hecha en otro dispositivo**: se aplica al cargar la página siguiente; una pestaña ya abierta no cambia sola.
- **Sin conexión**: la pantalla `/offline` usa el tema del sistema operativo, porque no puede leer la cuenta.
- **Acento amarillo en oscuro**: el amarillo como texto sobre fondo oscuro sí puede usarse si su contraste lo cumple; sobre claro sigue sin usarse (constitución, Color).
- **Eventos con color propio**: un evento con un color pastel propio sigue llevando el texto en tinta oscura en el tema oscuro.
- **Cambios rápidos**: pulsar "siguiente" varias veces seguidas no acumula animaciones; se muestra el periodo final.
- **Página oculta por Activity** (spec 008): una vista oculta no se anima al volver a mostrarse si su contenido no ha cambiado.
- **Impresión o captura**: no se contempla un estilo de impresión.

## Fuera de alcance

- Nuevos colores de acento, temas de colores adicionales o personalizar el degradado.
- Cambiar la disposición de las pantallas, la tipografía, los iconos o el logotipo.
- Animaciones de arrastrar para mover o redimensionar eventos (no existe esa función).
- Sonidos o vibración.
- Fondos con imágenes o fotos.

## Criterios de finalización

- RF-1 a RF-26 con su test o comprobación en verde.
- Test de contraste de los neutros y de los seis acentos en los dos temas.
- Guardia de diseño actualizada a las nuevas reglas de la constitución.
- Capturas a 390, 768 y 1440 px de todas las pantallas en los dos temas, con el acento rojo y el amarillo, y revisión con movimiento reducido.
- Verificación obligatoria completa con la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Ninguna bloqueante. El acceso directo del marco (RF-6) alterna claro y oscuro; volver a "Como el sistema" solo se hace desde Ajustes.
