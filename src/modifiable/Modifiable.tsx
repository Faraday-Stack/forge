import type { ComponentPropsWithRef, ElementType } from "react";
import { useModifiable } from "./useModifiable";
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

  if (!visible) return null;

  const renderedChildren = defaultText !== undefined ? (text || children) : children;

  return (
    <Tag id={id} style={{ ...externalStyle, ...style }} {...rest}>
      {renderedChildren}
    </Tag>
  );
}
