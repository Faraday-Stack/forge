import type { AgentStore } from "../provider/store";
import type { ModifiableContext, PageContext, PageSnapshot } from "../types";
import { getDomSnippet, getElementSource } from "../utils/source";
import { TOOL_SCHEMA } from "./tools";

export function buildSnapshot(store: AgentStore): PageSnapshot {
  return store.getState().snapshot();
}

/**
 * Build per-request runtime context: page url, route, and (where capturable) the
 * source location + DOM snippet of every registered modifiable.
 *
 * Source capture goes through React's `_debugSource` via fiber traversal — it's
 * present in dev but stripped in production. Missing source is normal and silent.
 *
 * Safe to call in non-browser environments (returns just `{modifiables: []}`).
 */
export function buildPageContext(store: AgentStore): PageContext {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { modifiables: [] };
  }

  const registry = store.getState().registry;
  const modifiables: ModifiableContext[] = Object.values(registry).map((entry) => {
    const el = document.getElementById(entry.id);
    const ctx: ModifiableContext = { id: entry.id };
    const source = getElementSource(el);
    if (source) ctx.source = source;
    const snippet = getDomSnippet(el);
    if (snippet) ctx.domSnippet = snippet;
    return ctx;
  });

  return {
    url: window.location.href,
    route: window.location.pathname,
    userAgent: navigator?.userAgent,
    modifiables,
  };
}

export function buildSystemPrompt(store: AgentStore): string {
  const snap = buildSnapshot(store);
  const { allowedStyleProps } = store.getState().permissions;

  return [
    "You are a UI modification agent. The user wants to change their web app's interface.",
    "Respond in a friendly, concise way. When you make changes, describe what you did briefly.",
    "You can call multiple tools in one response to accomplish the user's request.",
    "",
    // Inject the allowlist so the LLM knows exactly which properties it can use.
    // Without this the model hallucinates restrictions or attempts blocked properties.
    `## Allowed CSS properties for applyStyle`,
    allowedStyleProps.join(", "),
    "Only use properties from this list — others will be silently ignored.",
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
