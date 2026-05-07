import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { useModifiable } from "./useModifiable";
import { useAgentStore } from "../provider/context";
import { useDragHandle } from "./useDragHandle";
import { useFlipChildren } from "./useFlip";
import type { LayoutOverride, ModifiableEntry } from "../types";

function buildLayoutStyle(override: LayoutOverride): CSSProperties {
  switch (override.mode) {
    case "grid":
      return {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
        gap: 16,
        alignItems: "start",
      };
    case "kanban": {
      const cols = Math.min(6, Math.max(1, override.columns ?? 3));
      return {
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 16,
        alignItems: "start",
      };
    }
    case "timeline":
      return {
        display: "flex",
        flexDirection: "column",
        gap: 16,
        borderLeft: "2px solid currentColor",
        paddingLeft: 20,
        opacity: 0.98,
      };
    case "list":
    default:
      return {
        display: "flex",
        flexDirection: "column",
        gap: 12,
      };
  }
}

type ModifiableProps<T extends ElementType = "div"> = {
  id: string;
  as?: T;
  defaultText?: string;
  type?: ModifiableEntry["type"];
  containerId?: string;
} & Omit<ComponentPropsWithRef<T>, "id">;

/**
 * Declarative wrapper that registers an HTML element with Faraday and applies agent overrides.
 * Equivalent to calling `useModifiable` + rendering the target element manually.
 *
 * **Text content**: pass `defaultText` to make the element's text modifiable by the agent.
 * If you pass `children` instead, text is rendered as-is and the agent cannot change it via `setText`.
 *
 * **Containers**: set `type="container"` to allow the agent to insert registered components inside
 * this element via `insertComponent`. Inserted components render after the element's own children.
 *
 * @param id - Unique identifier for this element. Must be stable across renders.
 */
export function Modifiable<T extends ElementType = "div">({
  id,
  as,
  defaultText,
  type,
  containerId,
  children,
  style: externalStyle,
  ...rest
}: ModifiableProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const { text, style, visible, attributes } = useModifiable(id, {
    ...(defaultText !== undefined && { text: defaultText }),
    tag: typeof Tag === "string" ? Tag : "div",
    ...(type !== undefined && { type }),
    ...(containerId !== undefined && { containerId }),
  });

  const store = useAgentStore();
  const insertedList = useStore(store, (s) => s.insertedComponents[id] ?? []);
  const compRegistry = useStore(store, (s) => s.components);
  const pulseToken = useStore(store, (s) => s.pulsingIds[id]);
  const containerOrder = useStore(store, (s) => s.containerOrder[id]);
  const injections = useStore(store, (s) => s.injections[id] ?? []);
  const layoutOverride = useStore(store, (s) => s.layoutModes[id]);

  const ref = useRef<HTMLElement | null>(null);

  useDragHandle(ref, id, containerId, store);

  useEffect(() => {
    if (!pulseToken || !ref.current) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    ref.current.animate(
      [
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)", offset: 0 },
        { transform: "scale(1.08)", boxShadow: "0 0 0 14px rgba(249, 115, 22, 0.55)", offset: 0.25 },
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)", offset: 0.5 },
        { transform: "scale(1.08)", boxShadow: "0 0 0 14px rgba(249, 115, 22, 0.55)", offset: 0.75 },
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)", offset: 1 },
      ],
      { duration: 2000, iterations: 1, easing: "ease-in-out" },
    );
  }, [pulseToken]);

  // Build the unified ordered child list for containers. We split native JSX children
  // into id-bearing (orderable) and non-id (rendered first, in source order), then
  // append inserted components, then sort id-bearing+inserted by containerOrder.
  const isContainer = type === "container";
  const orderedIds: string[] = [];
  let renderedChildren: ReactNode = null;

  if (isContainer) {
    const nativeIdBearing: { id: string; element: ReactNode }[] = [];
    const nonIdChildren: ReactNode[] = [];

    for (const child of Children.toArray(children)) {
      if (isValidElement(child)) {
        const props = child.props as { id?: unknown };
        if (typeof props?.id === "string") {
          nativeIdBearing.push({ id: props.id, element: child });
          continue;
        }
      }
      nonIdChildren.push(child);
    }

    const insertedChildren: { id: string; element: ReactNode }[] = [];
    for (const inst of insertedList) {
      const entry = compRegistry[inst.componentName];
      if (!entry) continue;
      const Comp = entry.component;
      insertedChildren.push({
        id: inst.instanceId,
        element: <Comp key={inst.instanceId} {...inst.props} />,
      });
    }

    let combined = [...nativeIdBearing, ...insertedChildren];
    if (containerOrder && containerOrder.length > 0) {
      const indexOf = (childId: string) => {
        const i = containerOrder.indexOf(childId);
        return i === -1 ? Number.MAX_SAFE_INTEGER : i;
      };
      combined = combined
        .map((c, i) => ({ c, i }))
        .sort((a, b) => {
          const ia = indexOf(a.c.id);
          const ib = indexOf(b.c.id);
          if (ia !== ib) return ia - ib;
          return a.i - b.i;
        })
        .map((x) => x.c);
    }

    for (const c of combined) orderedIds.push(c.id);

    renderedChildren = (
      <>
        {nonIdChildren}
        {combined.map((c) => c.element)}
      </>
    );
  } else if (defaultText !== undefined) {
    renderedChildren = text || children;
  } else {
    renderedChildren = children;
  }

  // FLIP: animate children when their position in the container changes.
  // Hook must be called unconditionally; passes empty list when not a container.
  useFlipChildren(ref, orderedIds);

  if (!visible) return null;

  // Group agent-injected HTML by where it should go relative to this element.
  const injBefore = injections.filter((i) => i.position === "before");
  const injAfter = injections.filter((i) => i.position === "after");
  const injInsideStart = injections.filter((i) => i.position === "inside-start");
  const injInsideEnd = injections.filter((i) => i.position === "inside-end");

  const renderInjection = (i: { injectionId: string; html: string }) => (
    <span
      key={i.injectionId}
      data-faraday-injection={i.injectionId}
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: i.html }}
    />
  );

  // Layout overrides apply only to containers and merge after host/agent styles
  // so they win — the agent explicitly chose this layout.
  const layoutStyle =
    isContainer && layoutOverride ? buildLayoutStyle(layoutOverride) : null;

  return (
    <>
      {injBefore.map(renderInjection)}
      <Tag
        ref={ref}
        id={id}
        {...rest}
        {...attributes}
        style={{ ...externalStyle, ...style, ...layoutStyle }}
      >
        {injInsideStart.map(renderInjection)}
        {renderedChildren}
        {injInsideEnd.map(renderInjection)}
      </Tag>
      {injAfter.map(renderInjection)}
    </>
  );
}
