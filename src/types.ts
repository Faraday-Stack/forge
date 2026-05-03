import type { CSSProperties } from "react";

/** Agent-applied overrides for a single modifiable element. Merged on top of the element's base styles/text. */
export interface Override {
  text?: string;
  style?: CSSProperties;
  visible?: boolean;
}

/** A component instance inserted into a container by the agent. */
export interface InsertedComponent {
  instanceId: string;
  componentName: string;
  props: Record<string, unknown>;
  /** 0-based insertion index within the container's children. */
  position: number;
}

/** JSX source location captured from React's fiber tree. Dev-mode only. */
export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

/**
 * Registry entry for an element that the agent can target.
 *
 * `type` controls what the agent can do with the element:
 * - `"element"` (default) — style, text, and visibility changes
 * - `"text"` — text changes only
 * - `"container"` — accepts `insertComponent` / `reorder` actions; child components render inside it
 */
export interface ModifiableEntry {
  id: string;
  tag: string;
  type: "text" | "element" | "container";
  /** ID of the parent container this element belongs to, if nested. */
  containerId?: string;
  /** Current text content, kept in sync so the LLM snapshot reflects live state. */
  currentText?: string;
}

/**
 * Live DOM context for one modifiable, captured at the moment a request is sent.
 * Source location is best-effort — only present in dev builds where React keeps `_debugSource`.
 */
export interface ModifiableContext {
  id: string;
  source?: SourceLocation;
  domSnippet?: string;
}

/**
 * Per-request context sent alongside `messages`/`system`/`tools`. The backend persists
 * this on the request log so the dashboard can show *where* a change happened — not just *what*.
 */
export interface PageContext {
  url?: string;
  route?: string;
  userAgent?: string;
  modifiables: ModifiableContext[];
}

/**
 * Actions the LLM agent can dispatch. Each variant maps to a tool in TOOL_SCHEMA.
 *
 * - `applyStyle` — applies whitelisted CSS properties to a target element
 * - `setText` — replaces the text content of a target element
 * - `setVisibility` — shows or hides a target element
 * - `reorder` — reorders inserted components inside a container
 * - `insertComponent` — inserts a registered component into a container
 * - `undo` — replays the last N inverse actions from the history stack
 */
export type Action =
  | { type: "applyStyle"; targetId: string; properties: CSSProperties; scope?: "element" | "descendants" }
  | { type: "setText"; targetId: string; text: string }
  | { type: "setVisibility"; targetId: string; visible: boolean }
  | { type: "reorder"; containerId: string; order: string[] }
  | { type: "insertComponent"; containerId: string; componentName: string; props: Record<string, unknown>; position: number; instanceId: string }
  | { type: "undo"; steps?: number };

/** Inverse actions stored in the undo history. Each forward action computes its inverse before committing. */
export type InverseAction =
  | { type: "applyStyle"; targetId: string; properties: CSSProperties }
  | { type: "setText"; targetId: string; text: string }
  | { type: "setVisibility"; targetId: string; visible: boolean }
  | { type: "reorder"; containerId: string; order: string[] }
  | { type: "removeInserted"; containerId: string; instanceId: string };

/** Full page state sent to the LLM as context. Built by `buildSnapshot()` before each request. */
export interface PageSnapshot {
  modifiables: Array<ModifiableEntry & { currentText?: string; currentStyle?: CSSProperties }>;
  insertedComponents: Record<string, InsertedComponent[]>;
  /** Available components the agent may insert, with their prop schemas. */
  components: Array<{ name: string; props: Record<string, string> }>;
}

/**
 * Controls what the agent is allowed to do.
 *
 * - `allowedStyleProps` — CSS property names the agent may set via `applyStyle` (injection guard)
 * - `maxUndoDepth` — maximum number of undo steps retained (default 50)
 * - `persist` — where overrides survive page reloads: `"none"` (default), `"session"` (sessionStorage), `"user"` (localStorage)
 */
export interface PermissionsConfig {
  allowedStyleProps: string[];
  maxUndoDepth: number;
  persist: "none" | "session" | "user";
}

/**
 * A component the agent can insert into container elements.
 *
 * `propsSchema` is passed to the LLM so it knows what props to provide.
 * Each key should map to a human-readable description of the prop (e.g. `"string — required banner text"`).
 */
export interface ComponentRegistryEntry {
  component: React.ComponentType<Record<string, unknown>>;
  propsSchema?: Record<string, string>;
}

/** Connection parameters resolved by `streamAgentResponse`. One of the two modes must be provided. */
export interface AgentConnectionConfig {
  /** SaaS mode: publishable key issued by the Faraday dashboard. Requires `userToken`. */
  publishableKey?: string;
  /** SaaS mode: JWT identifying the end user. When null/undefined the backend applies an anonymous (stricter) rate limit. */
  userToken?: string | null;
  /** Self-hosted mode: full URL of your backend's streaming endpoint. */
  endpoint?: string;
  /** Override the default SaaS API URL (`https://api.faraday.ai/v1/stream`). */
  apiUrl?: string;
}

/**
 * Props for `UIAgentProvider`. Operates in one of two modes:
 *
 * **Self-hosted** — provide `endpoint` pointing at your own backend:
 * ```tsx
 * <UIAgentProvider endpoint="https://myapp.com/api/agent">
 * ```
 *
 * **SaaS** — provide `publishableKey` + `userToken` from the Faraday dashboard:
 * ```tsx
 * <UIAgentProvider publishableKey="pk_live_..." userToken={jwt}>
 * ```
 */
export interface UIAgentProviderProps extends AgentConnectionConfig {
  /** Additional components the agent can insert. Merged with DEFAULT_COMPONENTS. */
  components?: Record<string, ComponentRegistryEntry>;
  /** Override default permissions (allowed CSS props, undo depth, persistence). */
  permissions?: Partial<PermissionsConfig>;
  /** Called after every action the agent successfully applies. Useful for analytics or server-side persistence. */
  onAction?: (action: Action) => void;
  children: React.ReactNode;
}

/** Resolved override state with visibility defaulting to `true`. Returned by `useModifiable`. */
export interface ModifiableOverride extends Override {
  visible: boolean;
}

/** A message in the chat conversation between the user and the agent. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while the assistant is still streaming tokens for this message. */
  streaming?: boolean;
}
