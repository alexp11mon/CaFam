# Spec 054 — Pantalla "Ahora"

> Estado: **Aprobada** por el usuario el 2026-11-27, junto con el plan y las tareas ("Apruebo los tres"); la barra inferior queda como en el plan (D6). Implementada y **cerrada** con la aprobación del usuario el 2026-11-27 (rama `054-pantalla-ahora`). Origen: `docs/exploracion-proposito-familiar.md` (propuesta 1). Primera de la serie 054–059, que vuelve a centrar CaFam en coordinar a la familia.

## Contexto y objetivo

CaFam nació para que una madre vea en un solo sitio el horario de su hijo y sepa **qué está haciendo en cada momento**. Hoy esa pregunta solo se responde leyendo la rejilla del calendario: la vista mes (la que suele abrirse) no dice nada del momento actual, y en semana o día hay que buscar la línea de la hora entre los eventos de varias personas mezclados. Esta spec añade una pantalla "Ahora" que responde de un vistazo, persona a persona, "qué hace ahora y qué tiene después", con lo que el usuario ya puede ver hoy (calendarios compartidos y bloques "Ocupado" de la spec 020). No cambia ningún permiso.

## Usuarios / actores

- **Persona que consulta**: abre la app para saber qué hacen los suyos (el caso típico es una madre con rol Lector en los calendarios de su hijo).
- **Persona seguida**: alguien cuyo horario ve la persona que consulta, por compartir calendarios con ella (spec 003) o por haber consentido mostrar su disponibilidad (spec 020).
- **El propio usuario**: también aparece en su pantalla "Ahora".

## Historias de usuario

- H1: Como madre quiero abrir la app y ver qué está haciendo mi hijo ahora mismo, para no tener que llamarle.
- H2: Como madre quiero ver qué tiene después, para saber cuándo estará libre.
- H3: Como usuario quiero ver de un vistazo a todas las personas que sigo, para saber quién está libre ahora.
- H4: Como usuario quiero elegir que la app se abra en "Ahora" en lugar de en el calendario.
- H5: Como usuario sin conexión quiero seguir viendo "Ahora" con lo último que se descargó.

## Requisitos funcionales (criterios de aceptación en EARS)

### Contenido

- RF-1: EL SISTEMA ofrecerá una pantalla "Ahora" con una tarjeta por persona.
- RF-2: EL SISTEMA mostrará primero la tarjeta del propio usuario y después las de las personas seguidas, en el orden de personas guardado en los filtros (spec 002 RF-45).
- RF-3: EL SISTEMA considerará persona seguida a cada propietario de un calendario del que el usuario es miembro y que tenga visible en los filtros.
- RF-4: EL SISTEMA considerará también persona seguida a cada persona marcada en la sección "Disponibilidad" de los filtros (spec 020 RF-6).
- RF-5: SI una persona no tiene ningún calendario visible en los filtros ni está marcada en "Disponibilidad", ENTONCES EL SISTEMA no mostrará su tarjeta.
- RF-6: EL SISTEMA formará la tarjeta de una persona solo con los eventos de los calendarios visibles que esa persona posee, con las repeticiones ya expandidas.
- RF-7: MIENTRAS haya uno o más eventos con hora de esa persona en curso, EL SISTEMA mostrará en la tarjeta "Ahora" con el título, el nombre del calendario, el lugar si lo tiene y la hora de fin.
- RF-8: SI hay más de dos eventos con hora en curso a la vez, ENTONCES EL SISTEMA mostrará los dos que empezaron más tarde y "+N más".
- RF-9: MIENTRAS no haya ningún evento con hora en curso, EL SISTEMA mostrará "Libre" y, si hay un evento después en el mismo día, "hasta las HH:MM".
- RF-10: EL SISTEMA mostrará en la tarjeta "Después" con el siguiente evento con hora que empiece antes del final del día siguiente, con su hora de inicio y su título.
- RF-11: SI no hay ningún evento con hora hasta el final del día siguiente, ENTONCES EL SISTEMA mostrará "Nada más hoy ni mañana".
- RF-12: EL SISTEMA mostrará los eventos de día completo de hoy de esa persona como una línea aparte, encima de "Ahora", sin que cuenten como evento en curso.
- RF-13: EL SISTEMA mostrará en una tarjeta de una persona vista solo por disponibilidad "Ocupado hasta las HH:MM" o "Libre hasta las HH:MM", sin título, lugar ni calendario (spec 020 RF-3).
- RF-14: SI una persona es a la vez propietaria de calendarios visibles y está marcada en "Disponibilidad", ENTONCES EL SISTEMA mostrará los eventos que el usuario ve y, cuando no haya ninguno en curso pero sí un intervalo ocupado, "Ocupado hasta las HH:MM".
- RF-15: EL SISTEMA mostrará todas las horas en la zona horaria del perfil del usuario.

### Interacción

- RF-16: CUANDO el usuario pulse un evento de una tarjeta, EL SISTEMA abrirá ese evento como se abre desde el calendario (spec 008).
- RF-17: CUANDO el usuario pulse el nombre de una persona, EL SISTEMA abrirá la vista día de hoy mostrando solo los calendarios de esa persona, sin cambiar los filtros guardados.
- RF-18: EL SISTEMA no mostrará en esta pantalla botones para crear, mover ni borrar eventos.

### Actualización

- RF-19: MIENTRAS la pantalla esté abierta, EL SISTEMA recalculará qué está en curso y qué viene después al cambiar el minuto.
- RF-20: CUANDO cambie un evento que el usuario puede ver, EL SISTEMA actualizará la pantalla sin recargar, como el resto de la app (spec 019).
- RF-21: MIENTRAS no haya conexión, EL SISTEMA mostrará "Ahora" con la copia local de eventos (spec 034) y el aviso de sin conexión de la app.
- RF-22: MIENTRAS no haya conexión, EL SISTEMA mostrará las tarjetas de personas vistas solo por disponibilidad con "Sin datos sin conexión" en lugar de "Libre".

### Navegación e inicio

- RF-23: EL SISTEMA ofrecerá "Ahora" en la navegación principal, en el móvil y en el escritorio.
- RF-24: EL SISTEMA ofrecerá en Ajustes la opción "Pantalla de inicio" con los valores "Calendario" y "Ahora", con "Calendario" por defecto.
- RF-25: CUANDO el usuario abra la app con la opción "Ahora", EL SISTEMA le mostrará la pantalla "Ahora" en lugar del calendario.
- RF-26: EL SISTEMA guardará la opción de RF-24 en la cuenta, para que valga en todos sus dispositivos.

### Estados vacíos

- RF-27: SI el usuario no sigue a ninguna persona, ENTONCES EL SISTEMA mostrará su tarjeta y un mensaje que explica cómo unirse a un calendario o pedir que le compartan uno, con enlace a "Unirme con código".

## Requisitos no funcionales

- Privacidad (P3): la pantalla no lee nada que el usuario no pueda leer ya; las personas vistas por disponibilidad solo aportan inicio y fin. Los tests de base de datos de la spec 020 siguen valiendo; se añade uno que compruebe que "Ahora" no pide más datos que la rejilla.
- Rendimiento: con 8 personas y 3 calendarios cada una, la pantalla se pinta con datos en 1 s o menos en un móvil de gama media con la caché caliente (medido con el script de rendimiento existente).
- Mobile-first (P5): sin scroll horizontal entre 360 y 1920 px; en el escritorio las tarjetas pueden ir en varias columnas.
- Identidad visual (P9): solo tokens y componentes de la interfaz; cifras tabulares en las horas; capturas a 390, 768 y 1440 px, claro y oscuro, Violeta y Ámbar.
- Idioma (enmienda 15): todos los textos en español e inglés.
- Accesibilidad: cada tarjeta es una región con el nombre de la persona; el cambio de "Ahora" al pasar el minuto no se anuncia en voz alta salvo que cambie el estado (de "Libre" a un evento o al revés).
- Coste cero (P2): sin llamadas nuevas a servicios externos.

## Casos límite

- **Evento que termina exactamente ahora** (fin exclusivo): ya no está en curso; pasa a "Libre" o al siguiente.
- **Evento que cruza medianoche**: está en curso hasta su fin, aunque empezara ayer.
- **Evento de 0 minutos**: nunca está en curso; puede salir en "Después".
- **Evento en otra zona horaria** (spec 045): se muestra en la zona del perfil del que mira.
- **Cambio de hora** (horario de verano): "Después" usa el instante real, no la hora de pared.
- **Repetición borrada o movida** (excepción de serie): cuenta la excepción, no la regla.
- **Calendario traído de Google/iCloud con retraso**: se muestra lo último sincronizado; la pantalla no indica la hora de sincronización (ya está en "Mis calendarios").
- **Persona que deja de compartir** mientras la pantalla está abierta: su tarjeta desaparece en la siguiente actualización.
- **Usuario con 20 personas seguidas**: se muestran todas, en lista desplazable.
- **Persona con todos sus calendarios ocultos en los filtros**: no aparece (RF-5).
- **Copia sin conexión caducada** (más allá de +3 meses o sin descargar): "Sin datos sin conexión".

## Fuera de alcance

- Estado o ubicación en vivo de la persona (GPS, "estoy llegando"), y mensajes entre personas.
- Avisos push cuando alguien empieza o termina algo.
- Elegir qué personas salen en "Ahora" de forma distinta a los filtros.
- Widgets del sistema operativo o de la pantalla de bloqueo.
- Mostrar tareas (spec 048) o notas en "Ahora".
- El modo sencillo y la navegación reducida (spec 057).
- Cambiar qué ve cada persona (specs 056 y 059).

## Criterios de finalización

- RF-1 a RF-27 con su test (unitario o de componente) o comprobación manual en verde.
- Prueba manual con dos cuentas reales en el móvil (≤ 768 px) y en el escritorio: una con rol Lector en los calendarios de la otra, y una tercera vista solo por disponibilidad.
- Prueba sin conexión con Playwright y Edge (`scripts/e2e-offline*.mjs` o equivalente).
- Verificación obligatoria completa (P8), con `test:db` si el plan toca acceso a datos, y la salida reportada.
- Aprobación del usuario para cerrar la spec.

## Dudas abiertas

- Decisiones tomadas por defecto que el usuario puede cambiar al aprobar:
  - "Pantalla de inicio" es "Calendario" por defecto para no cambiar nada a quien ya usa la app; la spec 057 la pone en "Ahora" para el modo sencillo.
  - "Después" mira hasta el final del día siguiente, no más.
  - Las personas salen según los filtros del calendario, sin una lista propia.
- Resuelta el 2026-11-27 al aprobar el plan: la barra inferior queda "Ahora · Calendario | + | Notas · Más" y "Mis calendarios" pasa a "Más" (plan D6).
