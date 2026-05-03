import { createStore } from "zustand/vanilla";
import type { CSSProperties } from "react";
import { sanitizeStyleValue } from "../engine/sanitize";
import type {
  Override,
  InsertedComponent,
  ModifiableEntry,
  Action,
  InverseAction,
  PageSnapshot,
  PermissionsConfig,
  ComponentRegistryEntry,
  ChatMessage,
} from "../types";

const DEFAULT_PERMISSIONS: PermissionsConfig = {
  allowedStyleProps: [
    "color",
    "background",
    "backgroundColor",
    "fontSize",
    "fontWeight",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "borderRadius",
    "border",
    "gap",
    "display",
    "opacity",
    "textAlign",
    "letterSpacing",
    "lineHeight",
    "textDecoration",
  ],
  maxUndoDepth: 50,
  persist: "none",
};

export interface AgentState {
  overrides: Record<string, Override>;
  insertedComponents: Record<string, InsertedComponent[]>;
  history: InverseAction[][];
  registry: Record<string, ModifiableEntry>;
  messages: ChatMessage[];
  permissions: PermissionsConfig;
  components: Record<string, ComponentRegistryEntry>;
  /** id → incrementing token. Bumped when an action affects the id; cleared 2s later. */
  pulsingIds: Record<string, number>;

  register: (entry: ModifiableEntry) => void;
  unregister: (id: string) => void;
  apply: (action: Action, onAction?: (a: Action) => void) => string | null;
  undo: (steps?: number) => void;
  markPulsing: (ids: string[]) => void;
  snapshot: () => PageSnapshot;
  appendMessage: (message: ChatMessage) => void;
  appendToLastMessage: (delta: string) => void;
  setLastMessageStreaming: (streaming: boolean) => void;
  getPersistableState: () => {
    overrides: Record<string, Override>;
    insertedComponents: Record<string, InsertedComponent[]>;
  };
  hydrate: (snapshot: {
    overrides: Record<string, Override>;
    insertedComponents: Record<string, InsertedComponent[]>;
  }) => void;
}

export type AgentStore = ReturnType<typeof createAgentStore>;

export function createAgentStore(
  permissions: Partial<PermissionsConfig> = {},
  components: Record<string, ComponentRegistryEntry> = {},
) {
  const resolved: PermissionsConfig = {
    ...DEFAULT_PERMISSIONS,
    ...permissions,
  };

  return createStore<AgentState>()((set, get) => ({
    overrides: {},
    insertedComponents: {},
    history: [],
    registry: {},
    messages: [],
    permissions: resolved,
    components,
    pulsingIds: {},

    register(entry) {
      set((state) => ({ registry: { ...state.registry, [entry.id]: entry } }));
    },

    unregister(id) {
      set((state) => {
        const registry = { ...state.registry };
        delete registry[id];
        return { registry };
      });
    },

    apply(action, onAction) {
      if (action.type === "undo") {
        get().undo(action.steps);
        return null;
      }

      const { overrides, insertedComponents, registry, history, permissions } =
        get();

      // Validate that the target exists — either as a registered Modifiable or as a
      // previously inserted component instance (which uses instanceId as its targetId).
      if ("targetId" in action) {
        const inRegistry = action.targetId in registry;
        const inInserted = Object.values(insertedComponents)
          .flat()
          .some((c) => c.instanceId === action.targetId);
        if (!inRegistry && !inInserted) {
          return `Unknown targetId: ${action.targetId}`;
        }
      }
      // insertComponent skips this check because the container may not yet have any
      // inserted children and its containerId comes from the Modifiable registry, not insertedComponents.
      if ("containerId" in action && action.type !== "insertComponent") {
        if (!(action.containerId in registry)) {
          return `Unknown containerId: ${action.containerId}`;
        }
      }

      let inverse: InverseAction | null = null;
      const nextOverrides = { ...overrides };
      const nextInserted = { ...insertedComponents };

      if (action.type === "applyStyle") {
        // Filter to allowedStyleProps first, then sanitize each value for injection patterns.
        // The prev slice captures only the keys being changed so undo restores precisely those keys.
        const sanitized: CSSProperties = {};
        for (const [k, v] of Object.entries(action.properties)) {
          if (!permissions.allowedStyleProps.includes(k)) continue;
          const clean = sanitizeStyleValue(String(v));
          if (clean !== null) (sanitized as Record<string, unknown>)[k] = clean;
        }
        const prev = nextOverrides[action.targetId]?.style ?? {};
        const prevSlice: CSSProperties = {};
        for (const k of Object.keys(sanitized)) {
          (prevSlice as Record<string, unknown>)[k] = (
            prev as Record<string, unknown>
          )[k];
        }
        inverse = {
          type: "applyStyle",
          targetId: action.targetId,
          properties: prevSlice,
        };
        nextOverrides[action.targetId] = {
          ...nextOverrides[action.targetId],
          style: { ...prev, ...sanitized },
        };
      } else if (action.type === "setText") {
        const prev =
          nextOverrides[action.targetId]?.text ??
          registry[action.targetId]?.currentText ??
          "";
        inverse = { type: "setText", targetId: action.targetId, text: prev };
        nextOverrides[action.targetId] = {
          ...nextOverrides[action.targetId],
          text: action.text,
        };
      } else if (action.type === "setVisibility") {
        const prev = nextOverrides[action.targetId]?.visible ?? true;
        inverse = {
          type: "setVisibility",
          targetId: action.targetId,
          visible: prev,
        };
        nextOverrides[action.targetId] = {
          ...nextOverrides[action.targetId],
          visible: action.visible,
        };
      } else if (action.type === "reorder") {
        const current = (nextInserted[action.containerId] ?? []).map(
          (c) => c.instanceId,
        );
        inverse = {
          type: "reorder",
          containerId: action.containerId,
          order: current,
        };
        const sorted = (nextInserted[action.containerId] ?? [])
          .slice()
          .sort((a, b) => {
            return (
              action.order.indexOf(a.instanceId) -
              action.order.indexOf(b.instanceId)
            );
          });
        nextInserted[action.containerId] = sorted;
      } else if (action.type === "insertComponent") {
        inverse = {
          type: "removeInserted",
          containerId: action.containerId,
          instanceId: action.instanceId,
        };
        const existing = nextInserted[action.containerId] ?? [];
        const inserted: InsertedComponent = {
          instanceId: action.instanceId,
          componentName: action.componentName,
          props: action.props,
          position: action.position,
        };
        nextInserted[action.containerId] = [
          ...existing.slice(0, action.position),
          inserted,
          ...existing.slice(action.position),
        ];
      }

      // Prepend the inverse so undo replays in LIFO order; trim to maxUndoDepth.
      const nextHistory = inverse
        ? [[inverse], ...history].slice(0, permissions.maxUndoDepth)
        : history;

      set({
        overrides: nextOverrides,
        insertedComponents: nextInserted,
        history: nextHistory,
      });

      const affected: string[] = [];
      if (action.type === "applyStyle" || action.type === "setText" || action.type === "setVisibility") {
        affected.push(action.targetId);
      } else if (action.type === "reorder") {
        affected.push(action.containerId);
      } else if (action.type === "insertComponent") {
        affected.push(action.containerId, action.instanceId);
      }
      if (affected.length) get().markPulsing(affected);

      onAction?.(action);
      return null;
    },

    undo(steps = 1) {
      const { history, overrides, insertedComponents } = get();
      let nextOverrides = { ...overrides };
      let nextInserted = { ...insertedComponents };
      let remaining = history;
      const touched: string[] = [];

      // Walk the LIFO stack, replaying each group of inverse actions in order.
      for (let i = 0; i < steps && remaining.length > 0; i++) {
        const [inverses, ...rest] = remaining;
        remaining = rest;
        for (const inv of inverses) {
          if ("targetId" in inv) touched.push(inv.targetId);
          else if ("containerId" in inv) touched.push(inv.containerId);
          if (inv.type === "applyStyle") {
            nextOverrides[inv.targetId] = {
              ...nextOverrides[inv.targetId],
              style: {
                ...nextOverrides[inv.targetId]?.style,
                ...inv.properties,
              },
            };
          } else if (inv.type === "setText") {
            nextOverrides[inv.targetId] = {
              ...nextOverrides[inv.targetId],
              text: inv.text,
            };
          } else if (inv.type === "setVisibility") {
            nextOverrides[inv.targetId] = {
              ...nextOverrides[inv.targetId],
              visible: inv.visible,
            };
          } else if (inv.type === "reorder") {
            const current = nextInserted[inv.containerId] ?? [];
            const sorted = current.slice().sort((a, b) => {
              return (
                inv.order.indexOf(a.instanceId) -
                inv.order.indexOf(b.instanceId)
              );
            });
            nextInserted[inv.containerId] = sorted;
          } else if (inv.type === "removeInserted") {
            nextInserted[inv.containerId] = (
              nextInserted[inv.containerId] ?? []
            ).filter((c) => c.instanceId !== inv.instanceId);
          }
        }
      }

      set({
        overrides: nextOverrides,
        insertedComponents: nextInserted,
        history: remaining,
      });
      if (touched.length) get().markPulsing(touched);
    },

    markPulsing(ids) {
      set((state) => {
        const next = { ...state.pulsingIds };
        for (const id of ids) next[id] = (next[id] ?? 0) + 1;
        return { pulsingIds: next };
      });
      const tokens: Record<string, number> = {};
      const snap = get().pulsingIds;
      for (const id of ids) tokens[id] = snap[id];
      setTimeout(() => {
        set((state) => {
          const next = { ...state.pulsingIds };
          for (const id of ids) {
            // Only delete if no later mark superseded ours.
            if (next[id] === tokens[id]) delete next[id];
          }
          return { pulsingIds: next };
        });
      }, 2000);
    },

    snapshot() {
      const { registry, overrides, insertedComponents, components } = get();
      return {
        modifiables: Object.values(registry).map((entry) => {
          const style = overrides[entry.id]?.style;
          return {
            ...entry,
            ...(style !== undefined && { currentStyle: style }),
          };
        }),
        insertedComponents,
        components: Object.entries(components).map(([name, entry]) => ({
          name,
          props: entry.propsSchema ?? {},
        })),
      };
    },

    appendMessage(message) {
      set((s) => ({ messages: [...s.messages, message] }));
    },

    appendToLastMessage(delta) {
      set((s) => {
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (!last) return {};
        messages[messages.length - 1] = {
          ...last,
          content: last.content + delta,
        };
        return { messages };
      });
    },

    setLastMessageStreaming(streaming) {
      set((s) => {
        const messages = [...s.messages];
        const last = messages[messages.length - 1];
        if (!last) return {};
        messages[messages.length - 1] = { ...last, streaming };
        return { messages };
      });
    },

    getPersistableState() {
      const { overrides, insertedComponents } = get();
      return { overrides, insertedComponents };
    },

    hydrate(snapshot) {
      const { registry } = get();
      const overrides: Record<string, Override> = {};
      for (const [id, value] of Object.entries(snapshot.overrides ?? {})) {
        if (id in registry) overrides[id] = value;
      }
      const insertedComponents: Record<string, InsertedComponent[]> = {};
      for (const [containerId, list] of Object.entries(
        snapshot.insertedComponents ?? {},
      )) {
        if (containerId in registry) insertedComponents[containerId] = list;
      }
      set({ overrides, insertedComponents, history: [] });
    },
  }));
}
