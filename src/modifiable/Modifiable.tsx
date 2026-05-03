import type { ComponentPropsWithRef, ElementType } from "react";
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
    <Tag id={id} style={{ ...externalStyle, ...style }} {...rest}>
      {renderedChildren}
      {insertedElements}
    </Tag>
  );
}
