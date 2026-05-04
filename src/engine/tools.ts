export const TOOL_SCHEMA = [
  {
    name: "applyStyle",
    description:
      "Apply CSS properties to a modifiable element. Only whitelisted properties are applied.",
    input_schema: {
      type: "object",
      properties: {
        targetId: {
          type: "string",
          description: "The id of the modifiable element.",
        },
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
    description:
      "Reorder children of a container by providing a new order of child ids. Ids may be native Modifiable ids, inserted-component instanceIds, or any combination — they all share a single ordering. Ids not listed keep their relative source order at the end.",
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
    description:
      "Insert a registered component into a container at a given position.",
    input_schema: {
      type: "object",
      properties: {
        containerId: { type: "string" },
        componentName: {
          type: "string",
          description: "Must match a name from the components registry.",
        },
        props: { type: "object", additionalProperties: true },
        position: {
          type: "integer",
          description: "0-based insertion index.",
          default: 0,
        },
      },
      required: ["containerId", "componentName", "props"],
    },
  },
  {
    name: "injectHTML",
    description:
      "Inject inline HTML/SVG markup relative to ANY modifiable element (container or not). Use this when the user asks for something not in the component registry — charts, graphs, custom widgets, decorative SVG, badges with arbitrary shapes. You write the markup yourself; no pre-built component is required. Markup is sanitized server-side: <script> tags, on* event handlers, and javascript: URLs are stripped.",
    input_schema: {
      type: "object",
      properties: {
        targetId: {
          type: "string",
          description: "Id of any modifiable element to anchor against.",
        },
        html: {
          type: "string",
          description:
            "The raw HTML or SVG markup to inject. Prefer inline SVG for charts. Inline styles are allowed; class names are not.",
        },
        position: {
          type: "string",
          enum: ["before", "after", "inside-start", "inside-end"],
          default: "after",
          description:
            "Where to place the markup relative to the target element. 'after' renders adjacent below/right; 'inside-end' appends within the element.",
        },
      },
      required: ["targetId", "html"],
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
