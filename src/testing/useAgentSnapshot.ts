import { useStore } from "zustand";
import { useAgentStore } from "../provider/context";
import type { Override, InsertedComponent, InverseAction, ModifiableEntry, ChatMessage, Action } from "../types";

export interface AgentSnapshot {
  overrides: Record<string, Override>;
  insertedComponents: Record<string, InsertedComponent[]>;
  history: InverseAction[][];
  registry: Record<string, ModifiableEntry>;
  messages: ChatMessage[];
  /** Directly dispatch an action — useful for driving store state in tests/stories */
  apply: (action: Action) => string | null;
}

/**
 * Returns a live view of the agent store for use in tests and Storybook stories.
 * Must be used inside <UIAgentProvider> or <MockUIAgentProvider>.
 */
export function useAgentSnapshot(): AgentSnapshot {
  const store = useAgentStore();

  const overrides = useStore(store, (s) => s.overrides);
  const insertedComponents = useStore(store, (s) => s.insertedComponents);
  const history = useStore(store, (s) => s.history);
  const registry = useStore(store, (s) => s.registry);
  const messages = useStore(store, (s) => s.messages);

  return {
    overrides,
    insertedComponents,
    history,
    registry,
    messages,
    apply: (action) => store.getState().apply(action),
  };
}
