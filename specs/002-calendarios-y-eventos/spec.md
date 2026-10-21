# Spec 002 — Calendarios y eventos

> Estado: **Borrador pendiente de aprobación**. Constitución: `docs/constitution.md`. Parte de la spec 001 (cerrada).

## Contexto y objetivo

La spec 001 dejó cuentas, permisos y un panel que solo lista calendarios. Esta spec convierte la app en un calendario usable: el usuario crea y gestiona sus calendarios, crea eventos (con descripción, lugar, color y categoría propia) y los consulta en vistas mensual, semanal y diaria, mezclando todos sus calendarios con filtros. Reutiliza los permisos ya probados (Propietario, Editor, Lector) sin cambiarlos, de modo que la spec 003 solo tenga que añadir la forma de invitar a otras personas.

## Usuarios / actores

- **Usuario:** persona con sesión iniciada.
- **Propietario:** gestiona su calendario, sus categorías y sus eventos.
- **Editor:** gestiona categorías y eventos de un calendario ajeno (llegará con la spec 003; aquí se verifica con tests sobre la capa de datos).
- **Lector:** solo consulta un calendario ajeno (ídem).

## Historias de usuario

- H1: Como usuario quiero crear, renombrar, recolorear y borrar mis calendarios para organizar mi vida por ámbitos (familia, uni, trabajo).
- H2: Como usuario quiero crear, editar y borrar eventos con título, fechas, descripción, lugar y color para anotar lo que ocurre.
- H3: Como usuario quiero marcar un evento como de día completo o de varios días para cumpleaños, viajes o festivos.
- H4: Como usuario quiero crear categorías dentro de un calendario (p. ej. "Clases de la UNI") y asignarlas a mis eventos para agruparlos.
- H5: Como usuario quiero ver mis eventos por mes, por semana y por día para tener el panorama que necesite en cada momento.
- H6: Como usuario quiero ver juntos los eventos de todos mis calendarios y poder ocultar calendarios o categorías para centrarme en lo que me interesa.
- H7: Como Lector quiero ver eventos sin poder tocarlos, para que nadie los cambie por error.
- H8: Como usuario con muchos calendarios (propios y de otras personas) quiero verlos agrupados por persona, ordenarlos a mi gusto y elegir cuáles ver, para no perderme.
- H9: Como usuario quiero juntar varios calendarios míos en uno (p. ej. "Clases Uni" y "Examenes Uni" en "Universidad") para simplificar mi organización.

## Requisitos funcionales (criterios de aceptación en EARS)

### Calendarios

- RF-1: CUANDO un usuario envía el formulario de nuevo calendario con un nombre de 1 a 50 caracteres, EL SISTEMA creará el calendario con ese usuario como Propietario.
- RF-2: EL SISTEMA permitirá indicar en un calendario una descripción opcional de hasta 500 caracteres y un color elegido de una paleta cerrada de al menos 12 colores variados en tonos pastel y limpios, incluido el azul por defecto de la spec 001.
- RF-3: CUANDO el Propietario edita el nombre, la descripción o el color de un calendario, EL SISTEMA guardará los cambios y los mostrará en el panel y en las vistas.
- RF-4: SI el nombre del calendario está vacío o supera 50 caracteres, ENTONCES EL SISTEMA no guardará el calendario y mostrará el error en español junto al campo.
- RF-5: CUANDO el Propietario confirma el borrado de un calendario, EL SISTEMA lo borrará junto con sus eventos y sus categorías.
- RF-6: ANTES de borrar un calendario, EL SISTEMA pedirá una confirmación explícita que indique el nombre del calendario y avise de que se perderán sus eventos.
- RF-7: EL SISTEMA permitirá borrar cualquier calendario del Propietario, incluido "Mi calendario"; si el usuario se queda sin calendarios, el panel le ofrecerá crear uno.
- RF-8: SI un Editor o un Lector intenta editar o borrar un calendario ajeno, ENTONCES EL SISTEMA lo rechazará.

### Categorías

- RF-9: CUANDO el Propietario o un Editor crea una categoría en un calendario con un nombre de 1 a 40 caracteres, EL SISTEMA la creará dentro de ese calendario.
- RF-10: SI el nombre de la categoría ya existe en ese calendario (sin distinguir mayúsculas ni espacios exteriores), ENTONCES EL SISTEMA no creará un duplicado e informará del conflicto.
- RF-11: CUANDO el Propietario o un Editor renombra o borra una categoría, EL SISTEMA aplicará el cambio en todos los eventos que la usan.
- RF-12: CUANDO se borra una categoría, EL SISTEMA conservará sus eventos y los dejará "Sin categoría".
- RF-13: EL SISTEMA mostrará las categorías de un calendario a todos sus miembros y solo a ellos.
- RF-14: SI un Lector intenta crear, renombrar o borrar una categoría, ENTONCES EL SISTEMA lo rechazará.

### Eventos

- RF-15: CUANDO el Propietario o un Editor envía el formulario de evento con título (1 a 100 caracteres), calendario, inicio y fin válidos, EL SISTEMA creará el evento en ese calendario.
- RF-16: EL SISTEMA permitirá añadir a un evento una descripción opcional (hasta 2000 caracteres), un lugar opcional (hasta 200 caracteres), un color propio opcional de la paleta cerrada y una categoría opcional del mismo calendario.
- RF-17: MIENTRAS un evento no tenga color propio, EL SISTEMA lo mostrará con el color de su calendario.
- RF-18: SI el fin del evento es anterior a su inicio, ENTONCES EL SISTEMA no guardará el evento y mostrará un error en español junto al campo del fin.
- RF-19: SI el título está vacío o supera 100 caracteres, ENTONCES EL SISTEMA no guardará el evento y mostrará el error junto al campo.
- RF-20: DONDE el evento sea de día completo, EL SISTEMA pedirá solo fechas (sin horas) y lo guardará según la convención de eventos de día completo de la spec 001.
- RF-21: EL SISTEMA permitirá eventos que abarquen varios días, con o sin horas.
- RF-22: CUANDO el Propietario o un Editor edita un evento, EL SISTEMA guardará los cambios, incluido el cambio de categoría o de color, con las mismas validaciones que al crearlo.
- RF-23: CUANDO el Propietario o un Editor confirma el borrado de un evento, EL SISTEMA lo borrará de forma definitiva.
- RF-24: ANTES de borrar un evento, EL SISTEMA pedirá una confirmación explícita.
- RF-25: SI un Lector, o un usuario no miembro, intenta crear, editar o borrar un evento, ENTONCES EL SISTEMA lo rechazará.
- RF-26: MIENTRAS el usuario sea Lector de un calendario, EL SISTEMA mostrará sus eventos en solo lectura, sin botones de crear, editar ni borrar.
- RF-27: SI el usuario cambia un evento a otro calendario, ENTONCES EL SISTEMA solo lo permitirá si es Propietario o Editor de ambos, y borrará la categoría asignada si no existe en el calendario de destino.
- RF-28: EL SISTEMA no permitirá asignar a un evento una categoría de otro calendario.

### Vistas

- RF-29: EL SISTEMA ofrecerá las vistas mensual, semanal y diaria, y un control para cambiar entre ellas y moverse al periodo anterior, al siguiente y a "hoy".
- RF-30: CUANDO el usuario abre la sección de calendario, EL SISTEMA mostrará la vista mensual del mes actual con sus eventos.
- RF-31: EL SISTEMA mostrará en las vistas los eventos de todos los calendarios de los que el usuario es miembro, cada uno con su color.
- RF-32: EL SISTEMA permitirá ocultar y volver a mostrar cada calendario y cada categoría desde un panel de filtros (la organización del panel se define en RF-42 a RF-47).
- RF-33: MIENTRAS un filtro oculte un calendario o una categoría, EL SISTEMA no mostrará sus eventos en ninguna de las tres vistas.
- RF-34: EL SISTEMA mostrará los eventos con la hora de inicio y fin expresada en la zona horaria del perfil del usuario.
- RF-35: EL SISTEMA mostrará los eventos de día completo y de varios días en una franja destacada separada de los eventos con hora.
- RF-36: CUANDO el usuario abre un evento desde cualquier vista, EL SISTEMA mostrará su detalle completo (título, fechas, descripción, lugar, categoría, calendario).
- RF-37: CUANDO el usuario pulsa una celda de día en la vista mensual, EL SISTEMA abrirá la vista diaria de ese día.
- RF-38: CUANDO un periodo no tiene eventos, EL SISTEMA mostrará el periodo vacío con el mensaje "No hay eventos".
- RF-39: SI el día tiene más eventos de los que caben en su celda mensual, ENTONCES EL SISTEMA mostrará los visibles y un indicador "+N más" que lleve a la vista diaria.
- RF-40: SI los eventos de un mismo día se solapan en la vista semanal o diaria, ENTONCES EL SISTEMA los mostrará uno junto a otro sin taparse.

### Panel

- RF-41: EL SISTEMA mostrará en el panel un acceso al calendario, un acceso para crear calendarios y, en cada calendario, accesos para editarlo (solo si es Propietario) y para gestionar sus categorías (si es Propietario o Editor).

### Organización de calendarios por persona

- RF-42: EL SISTEMA agrupará en el panel de filtros los calendarios a los que el usuario tiene acceso por su propietario: primero el propio usuario y después cada persona que le comparte calendarios, con sus calendarios dentro.
- RF-43: CUANDO el usuario activa o desactiva un calendario en su lista, EL SISTEMA mostrará u ocultará sus eventos en las tres vistas.
- RF-44: CUANDO el usuario activa o desactiva a una persona, EL SISTEMA activará o desactivará de una vez todos los calendarios de esa persona.
- RF-45: CUANDO el usuario reordena personas o calendarios dentro de una persona, EL SISTEMA guardará el orden y lo aplicará en el panel de filtros y en el panel de inicio.
- RF-46: EL SISTEMA guardará por usuario qué calendarios están visibles y el orden elegido, y los recuperará al volver a entrar, también desde otro dispositivo.
- RF-47: CUANDO el usuario obtiene acceso a un calendario nuevo, EL SISTEMA lo mostrará visible y lo colocará al final de la lista de su propietario.
- RF-48: EL SISTEMA guardará esas preferencias de visibilidad y orden como privadas: solo las ve su usuario, y no afectan a lo que ven los demás.

### Juntar calendarios

- RF-49: CUANDO el Propietario elige dos o más calendarios propios, indica el nombre del resultado y confirma, EL SISTEMA moverá todos los eventos y categorías al calendario resultante y borrará los demás.
- RF-50: EL SISTEMA permitirá elegir como resultado uno de los calendarios elegidos (conservando su color y descripción) o uno nuevo.
- RF-51: SI dos categorías de los calendarios juntados tienen el mismo nombre (sin distinguir mayúsculas ni espacios exteriores), ENTONCES EL SISTEMA las unificará en una sola.
- RF-52: ANTES de juntar, EL SISTEMA mostrará una confirmación que liste los calendarios afectados, los que desaparecerán y cuántos eventos se moverán, y avisará de que la acción no se puede deshacer.
- RF-53: SI el usuario no es Propietario de alguno de los calendarios elegidos, ENTONCES EL SISTEMA no permitirá juntarlos.
- RF-54: SI falla la unión a mitad de proceso, ENTONCES EL SISTEMA no dejará cambios parciales: o se juntan todos los calendarios o no cambia ninguno.
- RF-55: CUANDO se juntan calendarios con miembros, EL SISTEMA conservará únicamente a los miembros del calendario resultante. [NECESITA ACLARACIÓN: los miembros se crean en la spec 003; ver Dudas abiertas.]

## Requisitos no funcionales

- Mobile-first (constitución P5): todas las pantallas nuevas se usan sin scroll horizontal entre 360 y 1920 px; en móvil la vista semanal puede mostrar menos días a la vez siempre que se pueda llegar a todos.
- Accesibilidad: los mismos criterios que la spec 001 (etiquetas visibles, errores anunciados, botones táctiles de al menos 44 px, uso completo con teclado, contraste mínimo 4,5:1) y los colores de la paleta cumplen contraste con el texto que llevan encima.
- Privacidad (P3): ningún evento, categoría ni calendario es visible para quien no sea miembro; se verifica con tests sobre la capa de datos.
- Idioma: todo texto visible en español; el primer día de la semana es el lunes.
- Rendimiento: abrir la vista mensual con 500 eventos en el mes tarda menos de 3 s en una conexión 4G.
- Coste cero (P2) y stack cerrado (P6): sin servicios nuevos; cualquier librería de calendario nueva requiere aprobación registrada en esta spec o en su plan.
- PWA: el service worker no cachea datos de calendarios ni eventos (privacidad en dispositivos compartidos).

## Casos límite

- Evento que cruza la medianoche (p. ej. 23:00 a 02:00): aparece en ambos días en las vistas.
- Evento de varios días en la vista semanal o mensual: se muestra en cada día que ocupa.
- Cambio de hora (horario de verano/invierno): la hora que el usuario escribió se conserva; no se desplaza una hora.
- Dos miembros con zonas horarias distintas ven el mismo instante, cada uno en su zona.
- Nombres o títulos con solo espacios: se tratan como vacíos.
- Evento con duración cero (inicio igual a fin): permitido.
- Dos usuarios editan el mismo evento a la vez: gana el último guardado, sin aviso.
- Borrar un calendario mientras otra pestaña lo tiene abierto: la acción siguiente falla con un mensaje claro de que ya no existe.
- Usuario sin calendarios: la sección de calendario muestra el estado vacío con el acceso a crear uno.
- Sin conexión: las pantallas muestran el aviso de conexión de la spec 001; no se guardan datos sin conexión.

## Fuera de alcance

- Eventos recurrentes (repetición diaria, semanal, anual…) y la edición de una ocurrencia o de una serie; se tratarán en una spec futura propia.
- Invitar a otros usuarios, cambiar roles o salir de un calendario (spec 003).
- Suscripciones `.ics` e importar/exportar (spec 004). Juntar con calendarios importados de Google, iCloud u Outlook se decidirá en la spec 004, cuando esos calendarios existan; aquí solo se juntan calendarios propios.
- Juntar calendarios ajenos o agrupar visualmente sin fusionar.
- Deshacer una fusión.
- Editar el perfil o la zona horaria del usuario (spec 005).
- Recordatorios, notificaciones, invitados a eventos, adjuntos, mapas o enlaces de videollamada.
- Arrastrar y soltar eventos, redimensionarlos o crearlos arrastrando sobre la cuadrícula.
- Búsqueda de eventos y vista de agenda/lista.
- Deshacer un borrado o papelera.
- Categorías compartidas entre calendarios o personales del usuario.
- Zona horaria distinta por evento.
- Uso sin conexión con datos.
- Tema oscuro e internacionalización.

## Criterios de finalización

- Todos los RF tienen test en verde (unitario, de componente o de base de datos según corresponda) y el checklist de verificación obligatoria pasa completo.
- Demo manual en móvil (≤ 768 px) y escritorio, en producción, del flujo: crear calendario → crear categoría → crear eventos (con hora, de día completo y de varios días) → verlos en las tres vistas → filtrar → editar → borrar.
- Las migraciones están aplicadas en dev y en prod, y `npm run test:db` está en verde (matriz de permisos ampliada).
- El usuario aprueba el cierre de la spec.

## Dudas abiertas

- [NECESITA ACLARACIÓN] Si los colores pastel no dan contraste 4,5:1 con texto blanco, el plan debe elegir texto oscuro sobre ellos o usar el color solo como borde/fondo; se decide en el plan.
- [NECESITA ACLARACIÓN] RF-55: al juntar calendarios con miembros distintos (posible desde la spec 003), ¿qué hacer con ellos? En esta spec solo hay un miembro por calendario (el propietario), así que el caso no se da; se revisará en la spec 003.
- [NECESITA ACLARACIÓN] ¿La librería de vistas de calendario es una dependencia nueva o se construyen las vistas a mano? Se decide y aprueba en el plan (P6).
