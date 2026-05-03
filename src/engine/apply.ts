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
    case "undo":
      action = { type: "undo", steps: (tool.input.steps as number) ?? 1 }; // default 1 step
      break;
    default:
      return `Unknown tool: ${tool.name}`;
  }

  return store.getState().apply(action);
}
