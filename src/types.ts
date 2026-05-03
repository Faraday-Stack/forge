import type { CSSProperties } from "react";

export interface Override {
  text?: string;
  style?: CSSProperties;
  visible?: boolean;
}

export interface InsertedComponent {
  instanceId: string;
  componentName: string;
  props: Record<string, unknown>;
  position: number;
}

export interface ModifiableEntry {
  id: string;
  tag: string;
  type: "text" | "element" | "container";
  containerId?: string;
  currentText?: string;
}

// Actions the agent can dispatch
export type Action =
  | { type: "applyStyle"; targetId: string; properties: CSSProperties; scope?: "element" | "descendants" }
  | { type: "setText"; targetId: string; text: string }
  | { type: "setVisibility"; targetId: string; visible: boolean }
  | { type: "reorder"; containerId: string; order: string[] }
  | { type: "insertComponent"; containerId: string; componentName: string; props: Record<string, unknown>; position: number; instanceId: string }
  | { type: "undo"; steps?: number };

// Inverse actions stored in the undo history
export type InverseAction =
  | { type: "applyStyle"; targetId: string; properties: CSSProperties }
  | { type: "setText"; targetId: string; text: string }
  | { type: "setVisibility"; targetId: string; visible: boolean }
  | { type: "reorder"; containerId: string; order: string[] }
  | { type: "removeInserted"; containerId: string; instanceId: string };

export interface PageSnapshot {
  modifiables: Array<ModifiableEntry & { currentText?: string; currentStyle?: CSSProperties }>;
  insertedComponents: Record<string, InsertedComponent[]>;
  components: Array<{ name: string; props: Record<string, string> }>;
}

export interface PermissionsConfig {
  allowedStyleProps: string[];
  maxUndoDepth: number;
  persist: "none" | "session" | "user";
}

export interface ComponentRegistryEntry {
  component: React.ComponentType<Record<string, unknown>>;
  propsSchema?: Record<string, string>;
}

export interface UIAgentProviderProps {
  endpoint: string;
  components?: Record<string, ComponentRegistryEntry>;
  permissions?: Partial<PermissionsConfig>;
  onAction?: (action: Action) => void;
  children: React.ReactNode;
}

export interface ModifiableOverride extends Override {
  visible: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}
