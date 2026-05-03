import { useRef, useMemo } from "react";
import { createAgentStore } from "./store";
import { AgentStoreContext, EndpointContext } from "./context";
import type { UIAgentProviderProps } from "../types";

export function UIAgentProvider({
  endpoint,
  components = {},
  permissions = {},
  onAction,
  children,
}: UIAgentProviderProps) {
  const storeRef = useRef<ReturnType<typeof createAgentStore> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createAgentStore(permissions, components);
  }

  // Expose onAction via a stable ref so apply() can call it without re-creating the store
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const store = storeRef.current;

  // Patch apply to thread through onAction
  const patchedStore = useMemo(() => {
    const original = store.getState().apply;
    store.setState({
      apply: (action: Parameters<typeof original>[0]) =>
        original(action, onActionRef.current ? (a) => onActionRef.current?.(a) : undefined),
    });
    return store;
  }, [store]);

  return (
    <EndpointContext.Provider value={endpoint}>
      <AgentStoreContext.Provider value={patchedStore}>
        {children}
      </AgentStoreContext.Provider>
    </EndpointContext.Provider>
  );
}
