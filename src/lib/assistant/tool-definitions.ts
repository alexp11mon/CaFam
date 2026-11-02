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
        "Busca eventos del usuario por una palabra de su título, lugar o descripción, desde un año atrás hasta un año adelante.",
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
];
