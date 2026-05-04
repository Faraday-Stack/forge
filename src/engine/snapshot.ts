import type { AgentStore } from "../provider/store";
import type { ModifiableContext, PageContext, PageSnapshot } from "../types";
import { getDomSnippet, getElementSource } from "../utils/source";
import { buildSpatialTree, renderTreeOutline } from "./spatialTree";
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
  const modifiables: ModifiableContext[] = Object.values(registry).map(
    (entry) => {
      const el = document.getElementById(entry.id);
      const ctx: ModifiableContext = { id: entry.id };
      const source = getElementSource(el);
      if (source) ctx.source = source;
      const snippet = getDomSnippet(el);
      if (snippet) ctx.domSnippet = snippet;
      return ctx;
    },
  );

  return {
    url: window.location.href,
    route: window.location.pathname,
    userAgent: navigator?.userAgent,
    modifiables,
    spatialTree: buildSpatialTree(store),
  };
}

export function buildSystemPrompt(store: AgentStore): string {
  const snap = buildSnapshot(store);
  const { allowedStyleProps } = store.getState().permissions;
  const tree = buildSpatialTree(store);
  const treeOutline = renderTreeOutline(tree);

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
    "## Page structure",
    "Document order, top-to-bottom. Indentation = parent/child. Only ids that appear here exist.",
    "```",
    treeOutline || "(no modifiables registered yet)",
    "```",
    "",
    "## Choosing where to insertComponent — strict rules",
    "You can only insertComponent into an id marked `[container]` in the tree above. Wrong placement is the most common failure mode — read these rules carefully.",
    "",
    "**Decision procedure for a spatial request like \"add X below Y\":**",
    "1. Find Y in the tree.",
    '2. Look for a [container] in this priority order: (a) Y itself if Y is a [container] — pick `position` 0 for "above", end for "below", anywhere for "inside"; (b) Y\'s nearest sibling on the requested side that is a [container]; (c) Y\'s nearest [container] ancestor — and only if you can express the position relative to Y\'s index among that container\'s children.',
    "3. If the only [container] available is geographically far from Y (different section, opposite side of the page, etc.), DO NOT use it as a fallback. Refuse instead, as described below.",
    "",
    "**When to refuse instead of insert:** no [container] exists near Y on the requested side; the only [container] available is in an unrelated part of the page; Y itself is not a [container] and nothing usable is nearby.",
    "",
    "**How to phrase a refusal.** Speak to a non-technical end user. NEVER mention components, props, JSX, ids, containers-by-name in code-voice, or what a developer would need to change.",
    "Frame the limitation as \"the developers have only given me access to adding things in <specific places, in plain spatial language>.\" Then offer those available places as alternatives. Translate each available [container] id into a plain-English location based on what's around it in the tree (e.g. `below-header` → \"just under the navigation\"; an inserted form's container → \"inside the contact form\"; a sidebar container → \"in the right-hand sidebar\").",
    "",
    'Example: *"Sorry — the developers have only given me access to adding components just under the navigation, near the top of the page. I can\'t place something directly below the social-proof bar. Want me to add it near the top instead, or somewhere else I have access to?"*',
    "",
    "**Other rules:**",
    "- Never invent a containerId. Only use ids that appear with `[container]` in the tree.",
    "- Inserted-component instanceIds (shown as `[inserted ...]`) can be referenced for reorder / remove, but are not valid containers.",
    "- Ids beginning with `__` are internal slots (e.g. notification toasts). Never place user-requested content there unless the user explicitly asked for a notification.",
    "",
    "## Modifiable details",
    "Use this map to look up styles/text/etc. when you need precise current values.",
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
    "## Container child order (per container)",
    "```json",
    JSON.stringify(snap.containerOrder, null, 2),
    "```",
    "",
    "Only target elements by the exact ids in the tree above.",
    "Only insert components that appear in the available components list.",
    "",
    "## Building forms",
    "To build a form, first insertComponent FaradayForm into a parent container with a unique `formId`. The form auto-registers a Modifiable container whose id equals that `formId`. In a follow-up turn (after the user sees the form appear) you can insertComponent field types — FaradayTextInput, FaradayTextarea, FaradaySelect, FaradayCheckbox, FaradayRadioGroup, FaradayNumberInput, FaradayEmailInput — into that new container. Each field's `name` prop becomes the FormData key on submit.",
    "",
    "## injectHTML — for anything not in the component registry",
    "When the user asks for something the registry doesn't include — a chart, graph, sparkline, gauge, custom widget, decorative SVG, badge with arbitrary shapes — DO NOT refuse. Use `injectHTML` to write the markup yourself.",
    "- Targets ANY id in the tree (containers OR regular elements). Container restriction does NOT apply.",
    "- Use inline SVG for charts/graphs (e.g. `<svg width=...><rect .../></svg>`). Use inline styles for layout. Class names are not honored.",
    "- Pick `position`: `before`/`after` to place adjacent to the target, `inside-start`/`inside-end` to nest inside it.",
    "- Generate complete, polished, on-brand markup — match colors and spacing to the surrounding page when possible.",
    "- The markup is sanitized: no `<script>`, no `on*=` event handlers, no `javascript:` URLs.",
    "Example for \"add a small bar chart next to the CTA button\": call injectHTML with targetId of the CTA button, position `after`, and an html field containing inline SVG bars.",
  ]
    .filter(Boolean)
    .join("\n");
}

export { TOOL_SCHEMA };
