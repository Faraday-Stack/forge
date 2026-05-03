import { useRef, useMemo } from "react";
import { useStore } from "zustand";
import { createPortal } from "react-dom";
import { createAgentStore } from "./store";
import type { AgentStore } from "./store";
import { AgentStoreContext, AgentConnectionContext } from "./context";
import type { UIAgentProviderProps } from "../types";
import { DEFAULT_COMPONENTS } from "../components";

/**
 * Root provider for the Faraday UI agent. Must wrap any part of the tree that uses
 * `Modifiable`, `useModifiable`, or `UIAgentLauncher`.
 *
 * Operates in two modes — supply exactly one:
 * - **Self-hosted**: `endpoint` pointing at your backend's streaming route
 * - **SaaS**: `publishableKey` + `userToken` (throws if `userToken` is missing)
 *
 * @throws if neither `publishableKey` nor `endpoint` is provided
 * @throws if `publishableKey` is set without a `userToken`
 */
export function UIAgentProvider({
  publishableKey,
  userToken,
  endpoint,
  apiUrl,
  components = {},
  permissions = {},
  onAction,
  children,
}: UIAgentProviderProps) {
  if (!publishableKey && !endpoint) {
    throw new Error(
      "[Faraday] UIAgentProvider requires either `publishableKey` + `userToken` (SaaS mode) or `endpoint` (self-hosted mode)."
    );
  }
  if (publishableKey && !userToken) {
    throw new Error(
      "[Faraday] UIAgentProvider: `userToken` is required when using `publishableKey`."
    );
  }
  const storeRef = useRef<ReturnType<typeof createAgentStore> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createAgentStore(permissions, {
      ...DEFAULT_COMPONENTS,
      ...components,
    });
    storeRef.current.getState().register({
      id: "__faraday-toasts__",
      tag: "div",
      type: "container",
    });
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
    <AgentConnectionContext.Provider value={{
        ...(publishableKey !== undefined && { publishableKey }),
        ...(userToken !== undefined && { userToken }),
        ...(endpoint !== undefined && { endpoint }),
        ...(apiUrl !== undefined && { apiUrl }),
      }}>
      <AgentStoreContext.Provider value={patchedStore}>
        {children}
        <ToastLayer store={patchedStore} />
      </AgentStoreContext.Provider>
    </AgentConnectionContext.Provider>
  );
}

function ToastLayer({ store }: { store: AgentStore }) {
  const insertedList = useStore(
    store,
    (s) => s.insertedComponents["__faraday-toasts__"] ?? [],
  );
  const compRegistry = useStore(store, (s) => s.components);

  if (insertedList.length === 0) return null;

  return createPortal(
    <div
      data-faraday
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 2147483644,
        pointerEvents: "auto",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {insertedList.map((inst) => {
        const entry = compRegistry[inst.componentName];
        if (!entry) return null;
        const Comp = entry.component;
        return <Comp key={inst.instanceId} {...inst.props} />;
      })}
    </div>,
    document.body,
  );
}
