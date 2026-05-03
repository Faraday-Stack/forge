import { useEffect, useRef, type ComponentPropsWithRef, type ElementType } from "react";
import { useStore } from "zustand";
import { useModifiable } from "./useModifiable";
import { useAgentStore } from "../provider/context";
import type { ModifiableEntry } from "../types";

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
  const { text, style, visible } = useModifiable(id, {
    ...(defaultText !== undefined && { text: defaultText }),
    tag: typeof Tag === "string" ? Tag : "div",
    ...(type !== undefined && { type }),
    ...(containerId !== undefined && { containerId }),
  });

  const store = useAgentStore();
  const insertedList = useStore(store, (s) => s.insertedComponents[id] ?? []);
  const compRegistry = useStore(store, (s) => s.components);
  const pulseToken = useStore(store, (s) => s.pulsingIds[id]);

  const ref = useRef<HTMLElement | null>(null);
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
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)" },
        { transform: "scale(1.03)", boxShadow: "0 0 0 6px rgba(249, 115, 22, 0.35)" },
        { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)" },
      ],
      { duration: 2000, iterations: 1, easing: "ease-in-out" },
    );
  }, [pulseToken]);

  if (!visible) return null;

  const renderedChildren = defaultText !== undefined ? (text || children) : children;

  const insertedElements =
    type === "container"
      ? insertedList.map((inst) => {
          const entry = compRegistry[inst.componentName];
          if (!entry) return null;
          const Comp = entry.component;
          return <Comp key={inst.instanceId} {...inst.props} />;
        })
      : null;

  return (
    <Tag ref={ref} id={id} style={{ ...externalStyle, ...style }} {...rest}>
      {renderedChildren}
      {insertedElements}
    </Tag>
  );
}
