import { useRef } from "react";
import { createAgentStore } from "../provider/store";
import { AgentStoreContext, AgentConnectionContext } from "../provider/context";
import { processStreamEvents } from "../streaming/client";
import { buildSystemPrompt } from "../engine/snapshot";
import { nanoid } from "../utils/nanoid";
import type {
  Override,
  ChatMessage,
  Action,
  PermissionsConfig,
  ComponentRegistryEntry,
} from "../types";
import type { MockStreamHandler } from "./createMockStream";

export interface MockUIAgentProviderProps {
  /** Pre-seed override values so components render as if the agent already acted */
  initialOverrides?: Record<string, Override>;
  initialMessages?: ChatMessage[];
  /** Called after every action dispatched to the store */
  onApply?: (action: Action) => void;
  /**
   * Drives the chat widget with a scripted event sequence instead of a real endpoint.
   * Create one with createMockStream().
   */
  mockHandler?: MockStreamHandler;
  permissions?: Partial<PermissionsConfig>;
  components?: Record<string, ComponentRegistryEntry>;
  children: React.ReactNode;
}

/**
 * Drop-in replacement for UIAgentProvider in tests and Storybook stories.
 * Uses the real store and apply pipeline — only the HTTP layer is mocked.
 */
export function MockUIAgentProvider({
  initialOverrides,
  initialMessages,
  onApply,
  mockHandler,
  permissions = {},
  components = {},
  children,
}: MockUIAgentProviderProps) {
  const storeRef = useRef<ReturnType<typeof createAgentStore> | null>(null);

  if (!storeRef.current) {
    const store = createAgentStore(permissions, components);

    if (initialOverrides) {
      store.setState({ overrides: initialOverrides });
    }
    if (initialMessages) {
      store.setState({ messages: initialMessages });
    }

    storeRef.current = store;
  }

  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  const store = storeRef.current;

  // Patch apply to thread through onApply spy
  const original = store.getState().apply;
  store.setState({
    apply: (action: Parameters<typeof original>[0]) =>
      original(
        action,
        onApplyRef.current ? (a) => onApplyRef.current?.(a) : undefined,
      ),
  });

  // Build a fake endpoint string; the mock interceptor below handles it
  const mockEndpoint = "__faraday_mock__";

  // When the widget calls fetch on mockEndpoint, intercept and run the mock handler
  const handlerRef = useRef(mockHandler);
  handlerRef.current = mockHandler;

  // Override fetch in a way that's scoped to this provider's send path.
  // We do this by passing a custom endpoint that the ChatPanel will POST to,
  // then intercepting via a global fetch override keyed to the sentinel URL.
  // A cleaner alternative used here: expose a custom stream trigger via context
  // so ChatPanel can call it without knowing about fetch at all.
  //
  // Instead of patching global fetch, we pass a data: URL that always 404s,
  // and provide an overridden streamAgentResponse via context so ChatPanel
  // uses the mock path. Since ChatPanel imports streamAgentResponse directly,
  // the simplest approach is to provide the mock endpoint string and intercept
  // via a module-level fetch override that only activates for our sentinel.

  // Register mock fetch interceptor once
  if (typeof globalThis !== "undefined" && handlerRef.current) {
    const sentinel = mockEndpoint;
    const originalFetch = globalThis.fetch;

    // Only wrap if not already wrapped for this sentinel
    if (!(globalThis.fetch as { __faradayMock?: boolean }).__faradayMock) {
      const wrapped = async function (
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

        if (url === sentinel && handlerRef.current) {
          let userMessage = "";
          try {
            const body = JSON.parse((init?.body as string) ?? "{}");
            const lastUser = [...(body.messages ?? [])]
              .reverse()
              .find((m: { role: string }) => m.role === "user");
            userMessage = lastUser?.content ?? "";
          } catch {
            // ignore parse errors
          }

          // Build a minimal Response whose body is an async iterable of events.
          // We can't pass an AsyncIterable to Response directly, so we hand off
          // to processStreamEvents after the store appends the assistant message.
          // Return a sentinel Response that the caller (streamAgentResponse) won't
          // error on, then drive the store from the mock handler directly.
          //
          // The cleanest path: return a fake ok Response with a ReadableStream
          // that emits our mock events as NDJSON.
          const handler = handlerRef.current;
          const snapshot = storeRef.current!.getState().snapshot();
          const events = handler(userMessage, snapshot);

          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              for await (const event of events) {
                const line = JSON.stringify(event) + "\n";
                controller.enqueue(encoder.encode(line));
              }
              controller.close();
            },
          });

          return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "application/x-ndjson" },
          });
        }

        return originalFetch(input, init);
      };
      (wrapped as { __faradayMock?: boolean }).__faradayMock = true;
      globalThis.fetch = wrapped;
    }
  }

  return (
    <AgentConnectionContext.Provider value={{ endpoint: mockEndpoint }}>
      <AgentStoreContext.Provider value={store}>
        {children}
      </AgentStoreContext.Provider>
    </AgentConnectionContext.Provider>
  );
}

/**
 * Directly drives a store with a mock stream without needing the widget UI.
 * Useful for unit tests that want to assert on store state after agent actions.
 */
export async function runMockStream(
  store: ReturnType<typeof createAgentStore>,
  userMessage: string,
  handler: MockStreamHandler,
): Promise<void> {
  const state = store.getState();

  state.appendMessage({ id: nanoid(), role: "user", content: userMessage });
  state.appendMessage({
    id: nanoid(),
    role: "assistant",
    content: "",
    streaming: true,
  });

  const snapshot = state.snapshot();
  const events = handler(userMessage, snapshot);
  await processStreamEvents(store, events);

  // Also build system prompt so tests can verify snapshot shape if needed
  buildSystemPrompt(store);
}
