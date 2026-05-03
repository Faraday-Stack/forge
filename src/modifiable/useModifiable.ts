import { useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useAgentStore } from "../provider/context";
import type { ModifiableEntry, ModifiableOverride } from "../types";

interface UseModifiableOptions {
  text?: string;
  visible?: boolean;
  tag?: string;
  type?: ModifiableEntry["type"];
  containerId?: string;
}

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

  const override = useStore(store, (s) => s.overrides[id]);

  return {
    text: override?.text ?? defaults.text ?? "",
    style: override?.style ?? {},
    visible: override?.visible ?? defaults.visible ?? true,
  };
}
