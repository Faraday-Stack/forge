import { useRef, useMemo, useEffect } from "react";
import { useStore } from "zustand";
import { createPortal } from "react-dom";
import { createAgentStore } from "./store";
import type { AgentStore } from "./store";
import {
  AgentStoreContext,
  AgentConnectionContext,
  AgentFormContext,
} from "./context";
import type { FormSubmitHandler } from "./context";
import type { UIAgentProviderProps } from "../types";
import { DEFAULT_COMPONENTS } from "../components";
import { loadOverrides } from "../persistence/client";
import { InlineEditOverlay } from "../widget/InlineEditOverlay";

/**
 * Root provider for the Faraday UI agent. Must wrap any part of the tree that uses
 * `Modifiable`, `useModifiable`, or `UIAgentLauncher`.
 *
 * Operates in two modes — supply exactly one:
 * - **Self-hosted**: `endpoint` pointing at your backend's streaming route
 * - **SaaS**: `publishableKey` (with optional `userToken`)
 *
 * `userToken` is optional; when omitted it defaults to `null` and the backend applies a stricter
 * anonymous rate limit.
 *
 * @throws if neither `publishableKey` nor `endpoint` is provided
 */
export function UIAgentProvider({
  publishableKey,
  userToken = null,
  endpoint,
  apiUrl,
  components = {},
  permissions = {},
  onAction,
  onFormSubmit,
  children,
}: UIAgentProviderProps) {
  if (!publishableKey && !endpoint) {
    throw new Error(
      "[Faraday] UIAgentProvider requires either `publishableKey` (SaaS mode) or `endpoint` (self-hosted mode).",
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

  // Stable form-submit handler: wraps the latest user-provided callback in a
  // ref so children can capture it once without re-rendering on each prop change.
  const onFormSubmitRef = useRef(onFormSubmit);
  onFormSubmitRef.current = onFormSubmit;
  const stableFormSubmit = useMemo<FormSubmitHandler>(
    () => async (formId, values) => onFormSubmitRef.current?.(formId, values),
    [],
  );

  const store = storeRef.current;

  // Patch apply to thread through onAction
  const patchedStore = useMemo(() => {
    const original = store.getState().apply;
    store.setState({
      apply: (action: Parameters<typeof original>[0]) =>
        original(
          action,
          onActionRef.current ? (a) => onActionRef.current?.(a) : undefined,
        ),
    });
    return store;
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    const connection = {
      ...(publishableKey !== undefined && { publishableKey }),
      userToken,
      ...(apiUrl !== undefined && { apiUrl }),
    };
    loadOverrides(connection)
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        // Defer one tick so initial Modifiables can register before we filter against the registry.
        queueMicrotask(() => {
          if (cancelled) return;
          patchedStore.getState().hydrate(snapshot);
        });
      })
      .catch((err) => {
        console.warn("[Faraday] Failed to load saved overrides:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [publishableKey, userToken, apiUrl, patchedStore]);

  return (
    <AgentConnectionContext.Provider
      value={{
        ...(publishableKey !== undefined && { publishableKey }),
        userToken,
        ...(endpoint !== undefined && { endpoint }),
        ...(apiUrl !== undefined && { apiUrl }),
      }}
    >
      <AgentStoreContext.Provider value={patchedStore}>
        <AgentFormContext.Provider value={stableFormSubmit}>
          <ThemeApplier store={patchedStore} />
          {children}
          <ToastLayer store={patchedStore} />
          <InlineEditOverlay />
        </AgentFormContext.Provider>
      </AgentStoreContext.Provider>
    </AgentConnectionContext.Provider>
  );
}

/**
 * Mirrors `themeVars` from the store onto `document.documentElement` and tracks
 * which vars we set so we can clean them up on unmount or when the agent clears
 * an override. Renders nothing.
 */
function ThemeApplier({ store }: { store: AgentStore }) {
  const themeVars = useStore(store, (s) => s.themeVars);
  const previouslyAppliedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const nowApplied = new Set(Object.keys(themeVars));

    for (const name of previouslyAppliedRef.current) {
      if (!nowApplied.has(name)) root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(themeVars)) {
      root.style.setProperty(name, value);
    }
    previouslyAppliedRef.current = nowApplied;
  }, [themeVars]);

  useEffect(() => {
    return () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      for (const name of previouslyAppliedRef.current) {
        root.style.removeProperty(name);
      }
      previouslyAppliedRef.current = new Set();
    };
  }, []);

  return null;
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
