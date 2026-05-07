import { nanoid } from "../utils/nanoid";
import type { AgentStore } from "../provider/store";
import type { Action } from "../types";

interface RawToolUse {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Translates a raw LLM tool call into a typed `Action` and forwards it to the store.
 *
 * @returns `null` on success, or an error string if the tool name is unknown or the
 * store rejects the action (e.g. unknown targetId).
 */
export function dispatchToolUse(
  store: AgentStore,
  tool: RawToolUse,
): string | null {
  let action: Action;

  switch (tool.name) {
    case "applyStyle":
      action = {
        type: "applyStyle",
        targetId: tool.input.targetId as string,
        properties: tool.input.properties as Record<string, string>,
        scope: (tool.input.scope as "element" | "descendants") ?? "element", // LLM may omit scope
      };
      break;
    case "setText":
      action = {
        type: "setText",
        targetId: tool.input.targetId as string,
        text: tool.input.text as string,
      };
      break;
    case "setVisibility":
      action = {
        type: "setVisibility",
        targetId: tool.input.targetId as string,
        visible: tool.input.visible as boolean,
      };
      break;
    case "reorder":
      action = {
        type: "reorder",
        containerId: tool.input.containerId as string,
        order: tool.input.order as string[],
      };
      break;
    case "insertComponent":
      action = {
        type: "insertComponent",
        containerId: tool.input.containerId as string,
        componentName: tool.input.componentName as string,
        props: (tool.input.props as Record<string, unknown>) ?? {},
        position: (tool.input.position as number) ?? 0,
        instanceId: nanoid(),
      };
      break;
    case "injectHTML": {
      const rawPos = (tool.input.position as string) ?? "after";
      // The model frequently emits DOM `insertAdjacentHTML` synonyms
      // (`beforebegin`, `afterend`, etc.) instead of our enum. Alias them
      // rather than silently fall back to "after" — that's what was sending
      // "above" requests below the target.
      const POSITION_ALIASES: Record<
        string,
        "before" | "after" | "inside-start" | "inside-end"
      > = {
        before: "before",
        after: "after",
        "inside-start": "inside-start",
        "inside-end": "inside-end",
        beforebegin: "before",
        afterend: "after",
        afterbegin: "inside-start",
        beforeend: "inside-end",
        above: "before",
        below: "after",
        prepend: "inside-start",
        append: "inside-end",
      };
      const position = POSITION_ALIASES[rawPos] ?? "after";
      action = {
        type: "injectHTML",
        targetId: tool.input.targetId as string,
        html: tool.input.html as string,
        position,
        injectionId: nanoid(),
      };
      break;
    }
    case "applyTheme":
      action = {
        type: "applyTheme",
        vars: (tool.input.vars as Record<string, string>) ?? {},
      };
      break;
    case "setLayout": {
      const mode = tool.input.mode as string;
      const allowed = ["list", "grid", "kanban", "timeline"] as const;
      if (!allowed.includes(mode as (typeof allowed)[number])) {
        return `setLayout: invalid mode '${mode}'`;
      }
      action = {
        type: "setLayout",
        targetId: tool.input.targetId as string,
        mode: mode as (typeof allowed)[number],
        ...(typeof tool.input.columns === "number" && {
          columns: tool.input.columns as number,
        }),
      };
      break;
    }
    case "setAttributes":
      action = {
        type: "setAttributes",
        targetId: tool.input.targetId as string,
        attributes: (tool.input.attributes as Record<string, string>) ?? {},
      };
      break;
    case "removeComponent":
      action = {
        type: "removeComponent",
        instanceId: tool.input.instanceId as string,
      };
      break;
    case "removeInjection":
      action = {
        type: "removeInjection",
        targetId: tool.input.targetId as string,
        injectionId: tool.input.injectionId as string,
      };
      break;
    case "undo":
      action = { type: "undo", steps: (tool.input.steps as number) ?? 1 }; // default 1 step
      break;
    default:
      return `Unknown tool: ${tool.name}`;
  }

  return store.getState().apply(action);
}
