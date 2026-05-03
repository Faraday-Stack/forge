export const TOOL_SCHEMA = [
  {
    name: "applyStyle",
    description: "Apply CSS properties to a modifiable element. Only whitelisted properties are applied.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "The id of the modifiable element." },
        properties: {
          type: "object",
          description: "CSS property/value pairs to apply.",
          additionalProperties: { type: "string" },
        },
        scope: {
          type: "string",
          enum: ["element", "descendants"],
          default: "element",
        },
      },
      required: ["targetId", "properties"],
    },
  },
  {
    name: "setText",
    description: "Set the text content of a modifiable element.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string" },
        text: { type: "string" },
      },
      required: ["targetId", "text"],
    },
  },
  {
    name: "setVisibility",
    description: "Show or hide a modifiable element.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string" },
        visible: { type: "boolean" },
      },
      required: ["targetId", "visible"],
    },
  },
  {
    name: "reorder",
    description: "Reorder inserted components inside a container by providing a new order of instanceIds.",
    input_schema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        order: { type: "array", items: { type: "string" } },
      },
      required: ["containerId", "order"],
    },
  },
  {
    name: "insertComponent",
    description: "Insert a registered component into a container at a given position.",
    input_schema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        componentName: { type: "string", description: "Must match a name from the components registry." },
        props: { type: "object", additionalProperties: true },
        position: { type: "integer", description: "0-based insertion index.", default: 0 },
      },
      required: ["containerId", "componentName", "props"],
    },
  },
  {
    name: "undo",
    description: "Undo the last N actions.",
    input_schema: {
      type: "object",
      properties: {
        steps: { type: "integer", default: 1, minimum: 1 },
      },
    },
  },
] as const;

export type ToolName = (typeof TOOL_SCHEMA)[number]["name"];
