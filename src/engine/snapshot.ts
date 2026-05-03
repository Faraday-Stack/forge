import type { AgentStore } from "../provider/store";
import type { PageSnapshot } from "../types";
import { TOOL_SCHEMA } from "./tools";

export function buildSnapshot(store: AgentStore): PageSnapshot {
  return store.getState().snapshot();
}

export function buildSystemPrompt(store: AgentStore): string {
  const snap = buildSnapshot(store);

  return [
    "You are a UI modification agent. The user wants to change their web app's interface.",
    "Respond in a friendly, concise way. When you make changes, describe what you did briefly.",
    "You can call multiple tools in one response to accomplish the user's request.",
    "",
    "## Current page elements",
    "```json",
    JSON.stringify(snap.modifiables, null, 2),
    "```",
    "",
    snap.components.length > 0
      ? [
          "## Available components (for insertComponent)",
          "```json",
          JSON.stringify(snap.components, null, 2),
          "```",
          "",
        ].join("\n")
      : "",
    "## Inserted components",
    "```json",
    JSON.stringify(snap.insertedComponents, null, 2),
    "```",
    "",
    "Only target elements by the exact ids listed above.",
    "Only insert components that appear in the available components list.",
  ]
    .filter(Boolean)
    .join("\n");
}

export { TOOL_SCHEMA };
