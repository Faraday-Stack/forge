import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "zustand";
import { useAgentStore } from "../provider/context";
import type { ModifiableEntry, ModifiableOverride, Override } from "../types";

interface UseModifiableOptions {
  text?: string;
  visible?: boolean;
  tag?: string;
  type?: ModifiableEntry["type"];
  containerId?: string;
}

/**
 * Resolve the effective style for an element by layering ancestor `descendantStyle`
 * overrides under its own `style`. Walks the live DOM ancestors of `id`, looks each
 * up in the override map, and merges outermost-first so the element's own style wins
 * on conflict.
 *
 * On first paint the live element may not be mounted yet, so we recompute via a
 * `useLayoutEffect` after mount. One frame may render without the cascade — that's
 * acceptable, since the no-cascade fallback is the existing behavior.
 */
function useResolvedStyle(
  id: string,
  overrides: Record<string, Override>,
): CSSProperties {
  const [resolved, setResolved] = useState<CSSProperties>(() => overrides[id]?.style ?? {});
  useLayoutEffect(() => {
    const own = overrides[id]?.style ?? {};
    if (typeof document === "undefined") {
      setResolved(own);
      return;
    }
    const el = document.getElementById(id);
    if (!el) {
      setResolved(own);
      return;
    }
    const cascade: CSSProperties[] = [];
    for (let cur = el.parentElement; cur; cur = cur.parentElement) {
      const ancestorId = cur.id;
      if (!ancestorId) continue;
      const ds = overrides[ancestorId]?.descendantStyle;
      if (ds) cascade.unshift(ds);
    }
    if (cascade.length === 0) {
      setResolved(own);
      return;
    }
    setResolved(Object.assign({}, ...cascade, own));
  }, [id, overrides]);
  return resolved;
}

/**
 * Registers an element with the Faraday store so the agent can target it, and returns
 * the current agent-applied overrides for that element.
 *
 * - Registers on mount, unregisters on unmount. Re-registers if `id` changes.
 * - The returned `text`, `style`, and `visible` values reflect agent overrides layered
 *   on top of `defaults`. When no override exists the defaults are returned as-is.
 *
 * @param id - Unique element identifier. Must match the `id` you pass to `<Modifiable>` or the LLM's target.
 * @param defaults - Initial values and registration metadata.
 * @returns `{ text, style, visible }` — apply these to your element's props.
 */
export function useModifiable(
  id: string,
  defaults: UseModifiableOptions = {},
): ModifiableOverride & { style: React.CSSProperties } {
  const store = useAgentStore();

  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    const entry: ModifiableEntry = {
      id,
      tag: defaultsRef.current.tag ?? "div",
      type: defaultsRef.current.type ?? "element",
      ...(defaultsRef.current.containerId !== undefined && {
        containerId: defaultsRef.current.containerId,
      }),
      ...(defaultsRef.current.text !== undefined && {
        currentText: defaultsRef.current.text,
      }),
    };
    store.getState().register(entry);
    return () => store.getState().unregister(id);
  }, [id, store]);

  const overrides = useStore(store, (s) => s.overrides);
  const override = overrides[id];
  const resolvedStyle = useResolvedStyle(id, overrides);

  return {
    text: override?.text ?? defaults.text ?? "",
    style: resolvedStyle,
    visible: override?.visible ?? defaults.visible ?? true,
    attributes: override?.attributes ?? {},
  };
}
