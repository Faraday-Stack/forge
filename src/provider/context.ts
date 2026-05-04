import { createContext, useContext } from "react";
import type { AgentStore } from "./store";
import type { AgentConnectionConfig } from "../types";

export const AgentStoreContext = createContext<AgentStore | null>(null);

export function useAgentStore(): AgentStore {
  const store = useContext(AgentStoreContext);
  if (!store) {
    throw new Error("useAgentStore must be used inside <UIAgentProvider>");
  }
  return store;
}

export const AgentConnectionContext = createContext<AgentConnectionConfig>({});

export function useAgentConnection(): AgentConnectionConfig {
  return useContext(AgentConnectionContext);
}

export type FormSubmitHandler = (
  formId: string,
  values: Record<string, FormDataEntryValue>,
) => void | Promise<void>;

export const AgentFormContext = createContext<FormSubmitHandler | undefined>(
  undefined,
);

export function useFormSubmit(): FormSubmitHandler | undefined {
  return useContext(AgentFormContext);
}
