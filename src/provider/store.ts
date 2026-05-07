import { createStore } from "zustand/vanilla";
import type { CSSProperties } from "react";
import {
  sanitizeStyleValue,
  sanitizeCssVarName,
  sanitizeAttributes,
} from "../engine/sanitize";
import {
  EMPTY_VIBE_PREFERENCES,
  mergeVibe,
  type VibePreferences,
} from "../engine/vibe";
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
  HtmlInjection,
  LayoutOverride,
} from "../types";
import { sanitizeHtmlMarkup } from "../engine/sanitize";

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
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "flexBasis",
    "flexGrow",
    "flexShrink",
  ],
  allowedAttributes: [
    "href",
    "src",
    "alt",
    "title",
    "placeholder",
    "type",
    "value",
    "name",
    "for",
    "checked",
    "disabled",
    "readonly",
    "required",
    "min",
    "max",
    "step",
    "pattern",
    "maxlength",
    "minlength",
    "rows",
    "cols",
    "wrap",
    "target",
    "rel",
    "download",
    "loading",
    "role",
    "tabindex",
    "aria-*",
    "data-*",
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
  /** containerId → desired order of child ids (mix of native Modifiable ids and inserted instanceIds). */
  containerOrder: Record<string, string[]>;
  /** targetId → list of injected HTML/SVG fragments rendered around the element. */
  injections: Record<string, HtmlInjection[]>;
  /** Active CSS custom-property overrides keyed by the canonical `--name` form. */
  themeVars: Record<string, string>;
  /** Per-container layout-mode override. */
  layoutModes: Record<string, LayoutOverride>;
  /** Cumulative tone/vibe signals extracted from this session's user messages. */
  vibePreferences: VibePreferences;

  register: (entry: ModifiableEntry) => void;
  unregister: (id: string) => void;
  apply: (action: Action, onAction?: (a: Action) => void) => string | null;
  undo: (steps?: number) => void;
  markPulsing: (ids: string[]) => void;
  snapshot: () => PageSnapshot;
  /** Update vibe preferences from a user message; tags are accumulated, not replaced. */
  observeUserMessage: (message: string) => void;
  appendMessage: (message: ChatMessage) => void;
  appendToLastMessage: (delta: string) => void;
  setLastMessageStreaming: (streaming: boolean) => void;
  getPersistableState: () => {
    overrides: Record<string, Override>;
    insertedComponents: Record<string, InsertedComponent[]>;
    containerOrder: Record<string, string[]>;
    injections: Record<string, HtmlInjection[]>;
    themeVars: Record<string, string>;
    layoutModes: Record<string, LayoutOverride>;
  };
  hydrate: (snapshot: {
    overrides: Record<string, Override>;
    insertedComponents: Record<string, InsertedComponent[]>;
    containerOrder?: Record<string, string[]>;
    injections?: Record<string, HtmlInjection[]>;
    themeVars?: Record<string, string>;
    layoutModes?: Record<string, LayoutOverride>;
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
    containerOrder: {},
    injections: {},
    themeVars: {},
    layoutModes: {},
    vibePreferences: EMPTY_VIBE_PREFERENCES,

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
      // setLayout requires the target be a registered container.
      if (action.type === "setLayout") {
        const entry = registry[action.targetId];
        if (!entry || entry.type !== "container") {
          return `setLayout: targetId '${action.targetId}' is not a [container]`;
        }
      }

      const { containerOrder, injections, themeVars, layoutModes } = get();
      let inverse: InverseAction | null = null;
      const nextOverrides = { ...overrides };
      const nextInserted = { ...insertedComponents };
      let nextContainerOrder = containerOrder;
      let nextInjections = injections;
      let nextThemeVars = themeVars;
      let nextLayoutModes = layoutModes;

      if (action.type === "applyStyle") {
        // Filter to allowedStyleProps first, then sanitize each value for injection patterns.
        // The prev slice captures only the keys being changed so undo restores precisely those keys.
        const sanitized: CSSProperties = {};
        for (const [k, v] of Object.entries(action.properties)) {
          if (!permissions.allowedStyleProps.includes(k)) continue;
          const clean = sanitizeStyleValue(String(v));
          if (clean !== null) (sanitized as Record<string, unknown>)[k] = clean;
        }
        const scope = action.scope ?? "element";
        const sliceKey = scope === "descendants" ? "descendantStyle" : "style";
        const prev = (nextOverrides[action.targetId]?.[sliceKey] ??
          {}) as CSSProperties;
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
          scope,
        };
        nextOverrides[action.targetId] = {
          ...nextOverrides[action.targetId],
          [sliceKey]: { ...prev, ...sanitized },
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
        // Inverse is the previous full order (containerOrder if set, else inserted order).
        const previous =
          containerOrder[action.containerId] ??
          (nextInserted[action.containerId] ?? []).map((c) => c.instanceId);
        inverse = {
          type: "reorder",
          containerId: action.containerId,
          order: previous,
        };
        nextContainerOrder = {
          ...nextContainerOrder,
          [action.containerId]: action.order,
        };
        // Also sort the inserted-components array for ids the new order mentions,
        // so render paths that read insertedComponents directly still see the new order.
        const inserted = nextInserted[action.containerId] ?? [];
        if (inserted.length > 0) {
          const indexOf = (id: string) => {
            const i = action.order.indexOf(id);
            return i === -1 ? Number.MAX_SAFE_INTEGER : i;
          };
          nextInserted[action.containerId] = inserted
            .slice()
            .sort((a, b) => indexOf(a.instanceId) - indexOf(b.instanceId));
        }
      } else if (action.type === "insertComponent") {
        inverse = {
          type: "restoreInserted",
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
      } else if (action.type === "injectHTML") {
        const cleanHtml = sanitizeHtmlMarkup(action.html);
        if (!cleanHtml) {
          return "injectHTML: markup empty after sanitization";
        }
        const next: HtmlInjection = {
          injectionId: action.injectionId,
          targetId: action.targetId,
          html: cleanHtml,
          position: action.position,
        };
        nextInjections = {
          ...nextInjections,
          [action.targetId]: [...(nextInjections[action.targetId] ?? []), next],
        };
        inverse = { type: "restoreInjection", injectionId: action.injectionId };
      } else if (action.type === "applyTheme") {
        // Sanitize each (name, value) pair. Empty value clears the var.
        const cleanedNew: Record<string, string> = {};
        const cleared: string[] = [];
        for (const [rawName, rawValue] of Object.entries(action.vars)) {
          const name = sanitizeCssVarName(rawName);
          if (!name) continue;
          if (rawValue === "" || rawValue == null) {
            cleared.push(name);
            continue;
          }
          const cleanValue = sanitizeStyleValue(String(rawValue));
          if (cleanValue == null) continue;
          cleanedNew[name] = cleanValue;
        }
        if (Object.keys(cleanedNew).length === 0 && cleared.length === 0) {
          return "applyTheme: no valid variables after sanitization";
        }
        // Inverse: previous values for every name we touched (null = was unset).
        const inverseVars: Record<string, string | null> = {};
        for (const name of [...Object.keys(cleanedNew), ...cleared]) {
          inverseVars[name] =
            name in nextThemeVars ? nextThemeVars[name] : null;
        }
        const merged = { ...nextThemeVars, ...cleanedNew };
        for (const name of cleared) delete merged[name];
        nextThemeVars = merged;
        inverse = { type: "applyTheme", vars: inverseVars };
      } else if (action.type === "setLayout") {
        const previous = nextLayoutModes[action.targetId] ?? null;
        const next: LayoutOverride = {
          mode: action.mode,
          ...(action.columns !== undefined && { columns: action.columns }),
        };
        nextLayoutModes = { ...nextLayoutModes, [action.targetId]: next };
        inverse = {
          type: "setLayout",
          targetId: action.targetId,
          previous,
        };
      } else if (action.type === "removeComponent") {
        let foundContainer: string | null = null;
        let foundComponent: InsertedComponent | null = null;
        for (const [cid, list] of Object.entries(nextInserted)) {
          const c = list.find((x) => x.instanceId === action.instanceId);
          if (c) {
            foundContainer = cid;
            foundComponent = c;
            break;
          }
        }
        if (!foundContainer || !foundComponent) {
          return `removeComponent: instanceId '${action.instanceId}' not found`;
        }
        nextInserted[foundContainer] = nextInserted[foundContainer].filter(
          (c) => c.instanceId !== action.instanceId,
        );
        if (nextContainerOrder[foundContainer]) {
          nextContainerOrder = {
            ...nextContainerOrder,
            [foundContainer]: nextContainerOrder[foundContainer].filter(
              (id) => id !== action.instanceId,
            ),
          };
        }
        inverse = {
          type: "insertComponent",
          containerId: foundContainer,
          component: foundComponent,
        };
      } else if (action.type === "removeInjection") {
        const list = nextInjections[action.targetId] ?? [];
        const found = list.find((j) => j.injectionId === action.injectionId);
        if (!found) {
          return `removeInjection: injectionId '${action.injectionId}' not on target '${action.targetId}'`;
        }
        nextInjections = {
          ...nextInjections,
          [action.targetId]: list.filter(
            (j) => j.injectionId !== action.injectionId,
          ),
        };
        inverse = { type: "injectHTML", injection: found };
      } else if (action.type === "setAttributes") {
        const cleaned = sanitizeAttributes(
          action.attributes,
          permissions.allowedAttributes,
        );
        if (Object.keys(cleaned).length === 0) {
          return "setAttributes: no allowed attributes after sanitization";
        }
        const prev = nextOverrides[action.targetId]?.attributes ?? {};
        const inverseAttrs: Record<string, string | null> = {};
        for (const k of Object.keys(cleaned)) {
          inverseAttrs[k] = k in prev ? prev[k] : null;
        }
        const merged: Record<string, string> = { ...prev };
        for (const [k, v] of Object.entries(cleaned)) {
          if (v == null) delete merged[k];
          else merged[k] = v;
        }
        nextOverrides[action.targetId] = {
          ...nextOverrides[action.targetId],
          attributes: merged,
        };
        inverse = {
          type: "setAttributes",
          targetId: action.targetId,
          attributes: inverseAttrs,
        };
      }

      // Prepend the inverse so undo replays in LIFO order; trim to maxUndoDepth.
      const nextHistory = inverse
        ? [[inverse], ...history].slice(0, permissions.maxUndoDepth)
        : history;

      set({
        overrides: nextOverrides,
        insertedComponents: nextInserted,
        containerOrder: nextContainerOrder,
        injections: nextInjections,
        themeVars: nextThemeVars,
        layoutModes: nextLayoutModes,
        history: nextHistory,
      });

      const affected: string[] = [];
      if (
        action.type === "applyStyle" ||
        action.type === "setText" ||
        action.type === "setVisibility"
      ) {
        affected.push(action.targetId);
      } else if (action.type === "reorder") {
        affected.push(action.containerId);
      } else if (action.type === "insertComponent") {
        affected.push(action.containerId, action.instanceId);
      } else if (action.type === "injectHTML") {
        affected.push(action.targetId);
      } else if (action.type === "setLayout") {
        affected.push(action.targetId);
      } else if (action.type === "setAttributes") {
        affected.push(action.targetId);
      } else if (action.type === "removeComponent") {
        affected.push(action.instanceId);
      } else if (action.type === "removeInjection") {
        affected.push(action.targetId);
      }
      if (affected.length) get().markPulsing(affected);

      onAction?.(action);
      return null;
    },

    undo(steps = 1) {
      const {
        history,
        overrides,
        insertedComponents,
        containerOrder,
        injections,
        themeVars,
        layoutModes,
      } = get();
      let nextOverrides = { ...overrides };
      let nextInserted = { ...insertedComponents };
      let nextContainerOrder = { ...containerOrder };
      let nextInjections = { ...injections };
      let nextThemeVars = { ...themeVars };
      let nextLayoutModes = { ...layoutModes };
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
            const sliceKey =
              inv.scope === "descendants" ? "descendantStyle" : "style";
            nextOverrides[inv.targetId] = {
              ...nextOverrides[inv.targetId],
              [sliceKey]: {
                ...(nextOverrides[inv.targetId]?.[sliceKey] ?? {}),
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
            nextContainerOrder[inv.containerId] = inv.order;
            const current = nextInserted[inv.containerId] ?? [];
            const indexOf = (id: string) => {
              const i = inv.order.indexOf(id);
              return i === -1 ? Number.MAX_SAFE_INTEGER : i;
            };
            nextInserted[inv.containerId] = current
              .slice()
              .sort((a, b) => indexOf(a.instanceId) - indexOf(b.instanceId));
          } else if (inv.type === "restoreInserted") {
            nextInserted[inv.containerId] = (
              nextInserted[inv.containerId] ?? []
            ).filter((c) => c.instanceId !== inv.instanceId);
            if (nextContainerOrder[inv.containerId]) {
              nextContainerOrder = {
                ...nextContainerOrder,
                [inv.containerId]: nextContainerOrder[inv.containerId].filter(
                  (id) => id !== inv.instanceId,
                ),
              };
            }
          } else if (inv.type === "restoreInjection") {
            for (const tId of Object.keys(nextInjections)) {
              const filtered = nextInjections[tId].filter(
                (j) => j.injectionId !== inv.injectionId,
              );
              if (filtered.length !== nextInjections[tId].length) {
                touched.push(tId);
                nextInjections[tId] = filtered;
              }
            }
          } else if (inv.type === "insertComponent") {
            const existing = nextInserted[inv.containerId] ?? [];
            const at = Math.min(inv.component.position, existing.length);
            nextInserted[inv.containerId] = [
              ...existing.slice(0, at),
              inv.component,
              ...existing.slice(at),
            ];
            touched.push(inv.containerId, inv.component.instanceId);
          } else if (inv.type === "injectHTML") {
            const tId = inv.injection.targetId;
            nextInjections[tId] = [
              ...(nextInjections[tId] ?? []),
              inv.injection,
            ];
            touched.push(tId);
          } else if (inv.type === "applyTheme") {
            for (const [name, value] of Object.entries(inv.vars)) {
              if (value == null) delete nextThemeVars[name];
              else nextThemeVars[name] = value;
            }
          } else if (inv.type === "setLayout") {
            if (inv.previous) nextLayoutModes[inv.targetId] = inv.previous;
            else delete nextLayoutModes[inv.targetId];
          } else if (inv.type === "setAttributes") {
            const cur = { ...(nextOverrides[inv.targetId]?.attributes ?? {}) };
            for (const [k, v] of Object.entries(inv.attributes)) {
              if (v == null) delete cur[k];
              else cur[k] = v;
            }
            nextOverrides[inv.targetId] = {
              ...nextOverrides[inv.targetId],
              attributes: cur,
            };
          }
        }
      }

      set({
        overrides: nextOverrides,
        insertedComponents: nextInserted,
        containerOrder: nextContainerOrder,
        injections: nextInjections,
        themeVars: nextThemeVars,
        layoutModes: nextLayoutModes,
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
      const {
        registry,
        overrides,
        insertedComponents,
        components,
        containerOrder,
        injections,
        themeVars,
        layoutModes,
      } = get();
      return {
        modifiables: Object.values(registry).map((entry) => {
          const style = overrides[entry.id]?.style;
          const descendantStyle = overrides[entry.id]?.descendantStyle;
          const attributes = overrides[entry.id]?.attributes;
          return {
            ...entry,
            ...(style !== undefined && { currentStyle: style }),
            ...(descendantStyle !== undefined && {
              currentDescendantStyle: descendantStyle,
            }),
            ...(attributes !== undefined && { currentAttributes: attributes }),
          };
        }),
        insertedComponents,
        containerOrder,
        injections,
        components: Object.entries(components).map(([name, entry]) => ({
          name,
          props: entry.propsSchema ?? {},
        })),
        themeVars,
        layoutModes,
      };
    },

    observeUserMessage(message) {
      set((s) => ({ vibePreferences: mergeVibe(s.vibePreferences, message) }));
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
      const {
        overrides,
        insertedComponents,
        containerOrder,
        injections,
        themeVars,
        layoutModes,
      } = get();
      return {
        overrides,
        insertedComponents,
        containerOrder,
        injections,
        themeVars,
        layoutModes,
      };
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
      const containerOrder: Record<string, string[]> = {};
      for (const [containerId, list] of Object.entries(
        snapshot.containerOrder ?? {},
      )) {
        if (containerId in registry) containerOrder[containerId] = list;
      }
      const injections: Record<string, HtmlInjection[]> = {};
      for (const [targetId, list] of Object.entries(
        (snapshot as { injections?: Record<string, HtmlInjection[]> })
          .injections ?? {},
      )) {
        if (targetId in registry) injections[targetId] = list;
      }
      const layoutModes: Record<string, LayoutOverride> = {};
      for (const [containerId, override] of Object.entries(
        snapshot.layoutModes ?? {},
      )) {
        if (containerId in registry) layoutModes[containerId] = override;
      }
      // themeVars are document-level, not registry-scoped — keep as-is.
      const themeVars = snapshot.themeVars ?? {};
      set({
        overrides,
        insertedComponents,
        containerOrder,
        injections,
        themeVars,
        layoutModes,
        history: [],
      });
    },
  }));
}
