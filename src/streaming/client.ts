import type { AgentStore } from "../provider/store";
import type { AgentConnectionConfig, ChatMessage } from "../types";
import { buildSystemPrompt, TOOL_SCHEMA } from "../engine/snapshot";
import { dispatchToolUse } from "../engine/apply";
import { nanoid } from "../utils/nanoid";

export interface StreamEvent {
  type: string;
  delta?: string;
  name?: string;
  input?: Record<string, unknown>;
  message?: string;
}

const FARADAY_API_URL = "https://api.faraday.ai/v1/stream";

function resolveRequest(connection: AgentConnectionConfig): {
  url: string;
  headers: Record<string, string>;
} {
  if (connection.publishableKey) {
    return {
      url: connection.apiUrl ?? FARADAY_API_URL,
      headers: {
        "Content-Type": "application/json",
        "X-Faraday-Key": connection.publishableKey,
        Authorization: `Bearer ${connection.userToken ?? ""}`,
      },
    };
  }
  return {
    url: connection.endpoint!,
    headers: { "Content-Type": "application/json" },
  };
}

export interface StreamOptions {
  connection: AgentConnectionConfig;
  store: AgentStore;
  userMessage: string;
  signal?: AbortSignal;
}

/**
 * Processes an async iterable of StreamEvents, updating the store as events arrive.
 * Extracted so the mock layer can feed events directly without going through fetch.
 */
export async function processStreamEvents(
  store: AgentStore,
  events: AsyncIterable<StreamEvent>,
): Promise<void> {
  try {
    for await (const event of events) {
      if (event.type === "text_delta" && event.delta) {
        store.getState().appendToLastMessage(event.delta);
      } else if (event.type === "tool_use" && event.name && event.input) {
        dispatchToolUse(store, { name: event.name, input: event.input });
      } else if (event.type === "error" && event.message) {
        store.getState().appendToLastMessage(`\n\n[Error: ${event.message}]`);
      }
    }
  } finally {
    store.getState().setLastMessageStreaming(false);
  }
}

async function* parseResponseStream(
  response: Response,
): AsyncIterable<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // The last element after split may be an incomplete line — keep it in the
      // buffer so it gets completed by the next chunk.
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(":")) continue;

        // Support both raw NDJSON and SSE (`data: {...}`) formats.
        const jsonStr = line.startsWith("data:") ? line.slice(5).trim() : line;
        // "[DONE]" is the OpenAI SSE end-of-stream sentinel — not valid JSON, skip it.
        if (!jsonStr || jsonStr === "[DONE]") continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(jsonStr) as StreamEvent;
        } catch {
          continue;
        }

        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Sends the conversation to the host backend endpoint and streams the response.
 *
 * Protocol: the endpoint receives { messages, system, tools } and must stream
 * Anthropic-compatible server-sent events or newline-delimited JSON with the shape:
 *
 *   { type: "text_delta", delta: string }
 *   { type: "tool_use", name: string, input: Record<string, unknown> }
 *   { type: "done" }
 *   { type: "error", message: string }
 */
export async function streamAgentResponse(
  options: StreamOptions,
): Promise<void> {
  const { connection, store, userMessage, signal } = options;
  const state = store.getState();

  const userMsg: ChatMessage = {
    id: nanoid(),
    role: "user",
    content: userMessage,
  };
  state.appendMessage(userMsg);

  state.appendMessage({
    id: nanoid(),
    role: "assistant",
    content: "",
    streaming: true,
  });

  const body = JSON.stringify({
    system: buildSystemPrompt(store),
    tools: TOOL_SCHEMA,
    messages: store
      .getState()
      .messages.filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content })),
  });

  const { url, headers } = resolveRequest(connection);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body,
      ...(signal !== undefined && { signal }),
    });
  } catch (err) {
    state.appendToLastMessage(`\n\n[Connection error: ${String(err)}]`);
    state.setLastMessageStreaming(false);
    return;
  }

  if (!response.ok) {
    state.appendToLastMessage(`\n\n[Server error: ${response.status}]`);
    state.setLastMessageStreaming(false);
    return;
  }

  await processStreamEvents(store, parseResponseStream(response));
}
