# Análisis: "20 Ways to Make Beautiful AI Animations"

Fuente: vídeo de TikTok de Charles Liu (@charles.unemployed), visto el 2026-11-07:
<https://www.tiktok.com/@charles.unemployed/video/7704685504305876242>. Dura 55 s. Cada consejo sale con una demostración "Before / After" de unos 2,7 s. Las notas de este documento salen de los fotogramas de esas demostraciones. No se copia nada del vídeo: solo se toman las ideas de movimiento.

La columna "CaFam hoy" describe el estado del código el 2026-11-07, después de las specs 011, 016, 017 y 019.

| # | Consejo | Demostración (antes → después) | Qué significa | CaFam hoy | RF |
|---|---------|------------------------------|---------------|-----------|----|
| 1 | Ease-out for entrances | Menú "Options": `ease-in 250ms` → `ease-out 250ms` | Lo que entra arranca rápido y frena al llegar: parece que responde al momento | Una sola curva para todo (entrar, salir y moverse). Frena al final, pero no se distingue entre casos | RF-1 |
| 2 | Dropdowns at 150–250ms | El mismo menú: `600ms` → `200ms` | Un desplegable lento hace esperar. Entre 150 y 250 ms se ve sin estorbar | Ventanas y diálogos en 220 ms. El menú contextual, la lista de horas y el selector de fecha flotante aparecen de golpe | RF-6 |
| 3 | Stagger list rows by 30ms | Lista: `200ms between rows` → `30ms between rows` | Las filas entran una tras otra con muy poca diferencia: la lista se lee como un conjunto que llega, no como una cola | Ninguna lista escalona | RF-16 a RF-18 |
| 4 | Scale to 0.97 on press | Botón "Save changes": sin respuesta → `scale(0.97) · 150ms` | El control se hunde un poco al pulsarlo | La utilidad `press` ya hace 0,97 en 150 ms en botones y controles, pero no en todo lo que se pulsa (filas de menú, opciones de listas, días del mini calendario) | RF-13 a RF-15 |
| 5 | Stretch moving knobs 12% | Interruptor: `Rigid circle` → `Area-preserving stretch` | La bolita de un interruptor se estira en el sentido en que viaja y conserva su área, como si tuviera masa | No hay interruptores: los ajustes de encender y apagar son casillas nativas | RF-40 a RF-46 |
| 6 | Stagger as details settle | Tarjeta "New message" con insignia: `Rigid, synchronized stop` → `Badge trails by 50ms` | En un elemento compuesto, el detalle secundario llega 50 ms después del cuerpo: se entiende qué es lo principal | Todo llega a la vez | RF-19 |
| 7 | Arcs for object movement | Un objeto va de "From" a "To": `Straight line` → `32px arc` | Los objetos físicos no viajan en línea recta: un arco suave hace natural un traslado largo | Un evento que vuelve a su sitio (fallo al guardar o "Deshacer") salta de golpe | RF-20 a RF-22 |
| 8 | Pulse to confirm success | "Save changes" → "saved": `Success label only` → `Success label + single pulse` | Un único pulso del control confirma que algo salió bien sin otro aviso | Solo hay texto de éxito o aviso | RF-47 a RF-51 |
| 9 | Ease-in-out for moves | Botón "Move" que se traslada: `linear 300ms` → `ease-in-out 300ms` | Lo que ya está en pantalla y cambia de sitio acelera al salir y frena al llegar | Los movimientos usan la misma curva que las entradas | RF-2 |
| 10 | Start popovers at 0.95 | Menú: `scale(0) → 1` → `scale(0.95) → 1` | Un desplegable que nace de la nada parece un salto. Desde el 95 % parece que ya estaba ahí | Las ventanas entran subiendo 8 px, sin escala | RF-7, RF-11 |
| 11 | Enter from the trigger | Menú bajo "Options": `transform-origin: center` → `top right` | El desplegable crece desde el botón que lo abrió | Todo entra desde su centro o desde abajo | RF-8, RF-10 |
| 12 | Exit to the trigger | Botón "Close": `Center-origin fade` → `Exits toward the trigger` | Al cerrarse, vuelve hacia el botón: se entiende de dónde salió y dónde volver a abrirlo | Igual que el anterior | RF-9 |
| 13 | No bounce on everyday UI | Tarjeta "Project settings": `Underdamped wobble` → `No overshoot` | El rebote cansa en lo que se usa a diario | Ninguna curva rebota. Se mantiene como regla escrita | RF-4 |
| 14 | Don't tween while held | Deslizador: `Tween while held` → `Direct pointer tracking` | Lo que se arrastra va pegado al dedo, sin retraso. Solo se anima al soltar | Arrastrar eventos y la hoja inferior ya sigue al puntero. Al deslizar el calendario, el cajón o el visor no se mueve nada hasta soltar | RF-23 a RF-31 |
| 15 | Make exits 20% shorter | Menú "Open": `250ms in / 250ms out` → `250ms in / 200ms out` | Salir importa menos que entrar: una salida más corta se nota más ágil | Entrar y salir duran lo mismo (220 ms) | RF-3 |
| 16 | Overlap old & new states | Botón "Saved": `Out → blank beat → in` → `Enter and exit overlap` | El estado nuevo entra mientras sale el viejo, sin un instante vacío | Los cambios de vista ya se solapan. Los textos de los botones ("Guardando…") saltan de golpe | RF-52, RF-53 |
| 17 | Masks for reveals & colour | Selector "Notes / Files": `Fade content / crossfade text` → `Clip content / mask text` | Se revela con un recorte que avanza, y el color del texto cambia justo por donde pasa la píldora | No existe. La constitución solo dejaba animar transform, opacity y filter: hace falta la enmienda 8 | RF-35 a RF-39 |
| 18 | Crossfade icons + blur | Icono ✓: `A hard icon replacement` → `Scale + opacity + blur` | Al cambiar un icono por otro, el viejo se encoge, se desenfoca y se desvanece mientras el nuevo hace lo contrario | El sol y la luna del tema cambian de golpe | RF-54 |
| 19 | Rubber band past bounds | "Drag" hasta "Limit": `Hard stop at the edge` → `Diminishing resistance` | Pasado el límite, el objeto sigue al dedo cada vez menos y vuelve al soltar | La hoja inferior tiene un tope seco de 40 px y el zoom de las horas se para en seco | RF-32, RF-33 |
| 20 | Reuse the same layoutId | Tarjeta "Project brief": `A disconnected replacement` → `The same object expands` | El mismo objeto se transforma, en lugar de desaparecer y salir otro distinto | La píldora del selector de vista salta. El detalle de un evento es una superficie nueva que no sale del bloque | RF-34, RF-55 a RF-62 |

## Conclusiones para CaFam

- **Ya se cumplen**: el 4 (en parte), el 13 y el 14 (en parte). La 011 dejó una base de movimiento correcta pero uniforme: una curva y una duración para todo.
- **Lo que más se nota**: el 20 (evento → detalle), el 14 y el 19 (seguir al dedo con goma), el 10, el 11 y el 12 (desplegables que nacen del botón) y el 17 (selector de vista y cambio de tema).
- **Choque con la constitución**: el 17 anima un recorte. El usuario aprobó la enmienda 8 el 2026-11-07 para permitirlo.
- **Decisiones del usuario** (2026-11-07): interruptor propio en Ajustes (consejo 5), transformación evento → detalle en la tarjeta, la hoja y la ventana (20), seguir al dedo en la vista, el cajón, la hoja y el visor (14 y 19), y escalonado solo en menús y listas, nunca en las vistas del calendario (3).
