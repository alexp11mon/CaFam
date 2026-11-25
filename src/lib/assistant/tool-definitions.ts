import type { ToolDefinition } from "./provider";

// What the model is told about the read-only tools (spec 015 plan contract,
// RF-25: none of them writes). Pure, so the loop can be tested without a server.

const dateParam = {
  type: "string",
  description: "Fecha AAAA-MM-DD en la zona del usuario",
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_events",
      description:
        "Eventos del usuario entre dos fechas, ambas incluidas (como mucho 62 días).",
      parameters: {
        type: "object",
        properties: { from: dateParam, to: dateParam },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description:
        "Busca eventos del usuario por una palabra de su título, lugar, descripción o comentarios, desde un año atrás hasta un año adelante. Si coincide un comentario, el evento trae matchedComment.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_free_time",
      description:
        "Huecos libres comunes del usuario y de otras personas entre dos fechas (como mucho 31 días).",
      parameters: {
        type: "object",
        properties: {
          people: {
            type: "array",
            items: { type: "string" },
            description: "Nombres de las otras personas, sin el usuario",
          },
          from: dateParam,
          to: dateParam,
          ranges: {
            type: "array",
            description: "Franjas HH:MM que pide la pregunta, si las da",
            items: {
              type: "object",
              properties: {
                start: { type: "string" },
                end: { type: "string" },
              },
              required: ["start", "end"],
            },
          },
        },
        required: ["people", "from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_comments",
      description:
        "Comentarios más recientes (como mucho 5) de eventos que ya te han dado las otras herramientas en esta pregunta. Úsala con los eventos que traen comments.",
      parameters: {
        type: "object",
        properties: {
          refs: {
            type: "array",
            items: { type: "string" },
            description: "Referencias de los eventos, como e1 (como mucho 10)",
          },
        },
        required: ["refs"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description:
        "Notas del usuario (spec 048). Sin note: los títulos y cuántos elementos quedan. Con note: lo pendiente y lo hecho de esa nota, o su texto.",
      parameters: {
        type: "object",
        properties: {
          note: {
            type: ["string", "null"],
            description: "Nombre de la nota tal como lo dice el usuario",
          },
        },
      },
    },
  },
];

// Spec 036: the write tools, offered only when the user asks to write
// (plan D2). The server finds the events and calendars by name (plan D1).

const nullableString = (description: string) => ({
  type: ["string", "null"],
  description,
});

const timeProperties = {
  calendar: nullableString(
    "Nombre del calendario tal como lo dice el usuario; null si no dice ninguno",
  ),
  date: nullableString("Día AAAA-MM-DD; null si sale de after o before"),
  start: nullableString("Hora de inicio HH:MM de 24 horas"),
  end: nullableString("Hora de fin HH:MM de 24 horas"),
  endDate: nullableString("Día de fin AAAA-MM-DD si no es el de inicio"),
  allDay: {
    type: ["boolean", "null"],
    description: "true si el usuario dice que es de todo el día",
  },
  durationMinutes: {
    type: ["integer", "null"],
    description: "Duración en minutos si el usuario la dice",
  },
  after: nullableString(
    "Título del evento tras el que empieza: «cuando acabe PIAE» es PIAE",
  ),
  before: nullableString(
    "Título del evento antes del que acaba: «justo antes de PIAE» o «hasta PIAE» es PIAE",
  ),
  anchorDate: nullableString(
    "Día AAAA-MM-DD del evento de after o before si el usuario lo dice",
  ),
  location: nullableString("Lugar"),
  description: nullableString("Descripción"),
};

export const WRITE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "create_notes",
      description:
        'Crea en el acto de 1 a 3 notas nuevas. Una lista con sus elementos en items; un texto en text. Ejemplo: «Crea una lista Maleta con bañador y crema» es {"notes":[{"title":"Maleta","items":["bañador","crema"]}]}.',
      parameters: {
        type: "object",
        properties: {
          notes: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título de la nota" },
                kind: {
                  type: ["string", "null"],
                  enum: ["list", "text", null],
                  description: "list para una lista de tareas, text para texto",
                },
                items: {
                  type: ["array", "null"],
                  items: { type: "string" },
                  description: "Elementos de la lista",
                },
                text: nullableString("Texto de una nota de texto"),
                calendar: nullableString(
                  "Calendario donde compartirla si el usuario lo dice; si no, null (personal)",
                ),
              },
              required: ["title"],
            },
          },
        },
        required: ["notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_note_items",
      description:
        'Añade elementos al final de una lista que ya existe. Ejemplo: «apunta leche y pan en la lista de la compra» es {"note":"compra","items":["leche","pan"]}.',
      parameters: {
        type: "object",
        properties: {
          note: {
            type: "string",
            description: "Nombre de la lista tal como lo dice el usuario",
          },
          items: {
            type: "array",
            items: { type: "string" },
            description: "Elementos que hay que añadir",
          },
        },
        required: ["note", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_events",
      description:
        'Crea en el acto de 1 a 3 eventos sueltos. Todos en una sola llamada. Ejemplo: «Crea Comida Uni cuando acabe PIAE hasta las 14:30» es {"events":[{"title":"Comida Uni","after":"PIAE","end":"14:30"}]}.',
      parameters: {
        type: "object",
        properties: {
          events: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título del evento" },
                ...timeProperties,
              },
              required: ["title"],
            },
          },
        },
        required: ["events"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_changes",
      description:
        "Prepara de 1 a 3 cambios de eventos que ya existen. No cambia nada: el usuario los confirma. Pon solo lo que cambia.",
      parameters: {
        type: "object",
        properties: {
          changes: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                event: {
                  type: "string",
                  description: "Título del evento que hay que cambiar",
                },
                eventDate: nullableString(
                  "Día AAAA-MM-DD de ese evento si el usuario lo dice",
                ),
                scope: {
                  type: ["string", "null"],
                  enum: ["this", "following", "all", null],
                  description:
                    "Solo en eventos que se repiten: all si dice todos, following si dice a partir de este; si no, null",
                },
                title: nullableString("Título nuevo"),
                ...timeProperties,
                calendar: nullableString(
                  "Calendario nuevo si hay que moverlo; si no, null",
                ),
              },
              required: ["event"],
            },
          },
        },
        required: ["changes"],
      },
    },
  },
];
