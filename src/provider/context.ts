import { createContext, useContext } from "react";
import type { AgentStore } from "./store";

export const AgentStoreContext = createContext<AgentStore | null>(null);

export function useAgentStore(): AgentStore {
  const store = useContext(AgentStoreContext);
  if (!store) {
    throw new Error("useAgentStore must be used inside <UIAgentProvider>");
  }
  return store;
}

export const EndpointContext = createContext<string>("");

export function useEndpoint(): string {
  return useContext(EndpointContext);
}
