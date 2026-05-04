import type { AgentStore } from "../provider/store";
import type { SpatialNode } from "../types";

const PREVIEW_MAX = 40;

/**
 * Build a DOM-anchored tree of registered modifiables (and their inserted
 * components). Children of each node are in document order, so "above/below"
 * semantics in user requests map cleanly to "earlier/later in the children list".
 *
 * Modifiables that are in the registry but have no live DOM element appear as
 * top-level entries with `unmounted: true` so the agent isn't surprised by them.
 *
 * Safe to call without a DOM (returns `[]`).
 */
export function buildSpatialTree(store: AgentStore): SpatialNode[] {
  if (typeof document === "undefined") return [];

  const { registry, insertedComponents } = store.getState();
  const registeredIds = new Set(Object.keys(registry));
  const root: SpatialNode[] = [];
  const nodeById = new Map<string, SpatialNode>();

  const walk = (el: Element, parent: SpatialNode | null): void => {
    let nextParent = parent;
    if (el.id && registeredIds.has(el.id)) {
      const entry = registry[el.id];
      const node: SpatialNode = {
        id: el.id,
        tag: entry.tag,
        type: entry.type,
        children: [],
      };
      const text = entry.currentText ?? el.textContent?.trim() ?? "";
      if (text) {
        node.textPreview =
          text.length > PREVIEW_MAX ? text.slice(0, PREVIEW_MAX) + "…" : text;
      }
      nodeById.set(el.id, node);
      if (parent) parent.children.push(node);
      else root.push(node);
      nextParent = node;
    }
    for (const child of Array.from(el.children)) walk(child, nextParent);
  };

  walk(document.body, null);

  // Slot inserted-component instances into their container nodes. Order matches
  // insertedComponents[containerId], which the store keeps in sync with the
  // unified containerOrder.
  for (const [containerId, instances] of Object.entries(insertedComponents)) {
    const containerNode = nodeById.get(containerId);
    if (!containerNode) continue;
    for (const inst of instances) {
      containerNode.children.push({
        id: inst.instanceId,
        tag: inst.componentName,
        type: "element",
        isInserted: true,
        children: [],
      });
    }
  }

  // Surface registry entries that never made it into the DOM (rare, but possible
  // during fast-mount races or when a Modifiable's host React tree unmounted).
  for (const id of registeredIds) {
    if (!nodeById.has(id)) {
      const entry = registry[id];
      root.push({
        id,
        tag: entry.tag,
        type: entry.type,
        unmounted: true,
        children: [],
      });
    }
  }

  return root;
}

/**
 * Render a SpatialNode tree as a tight YAML-like outline that the LLM can scan
 * to answer "above/below/inside" questions. Indentation = nesting depth.
 */
export function renderTreeOutline(tree: SpatialNode[], depth = 0): string {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const node of tree) {
    const tag = node.isInserted ? `[inserted ${node.tag}]` : `(${node.tag})`;
    const flags: string[] = [];
    if (node.type === "container" && !node.isInserted) flags.push("container");
    if (node.unmounted) flags.push("unmounted");
    const flagStr = flags.length ? ` [${flags.join(", ")}]` : "";
    const text = node.textPreview ? ` "${node.textPreview}"` : "";
    lines.push(`${indent}- ${node.id} ${tag}${flagStr}${text}`);
    if (node.children.length > 0) {
      lines.push(renderTreeOutline(node.children, depth + 1));
    }
  }
  return lines.join("\n");
}
