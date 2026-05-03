import type { AgentStore } from "../provider/store";
import type { ChatMessage } from "../types";
import { buildSystemPrompt, TOOL_SCHEMA } from "../engine/snapshot";
import { dispatchToolUse } from "../engine/apply";
import { nanoid } from "../utils/nanoid";

export interface StreamOptions {
  endpoint: string;
  store: AgentStore;
  userMessage: string;
  signal?: AbortSignal;
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
export async function streamAgentResponse(options: StreamOptions): Promise<void> {
  const { endpoint, store, userMessage, signal } = options;
  const state = store.getState();

  const userMsg: ChatMessage = {
    id: nanoid(),
    role: "user",
    content: userMessage,
  };
  state.appendMessage(userMsg);

  const assistantMsgId = nanoid();
  state.appendMessage({
    id: assistantMsgId,
    role: "assistant",
    content: "",
    streaming: true,
  });

  const body = JSON.stringify({
    system: buildSystemPrompt(store),
    tools: TOOL_SCHEMA,
    messages: store.getState().messages
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({ role, content })),
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
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

  const reader = response.body?.getReader();
  if (!reader) {
    state.setLastMessageStreaming(false);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process all complete newline-delimited JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith(":")) continue;

        // Strip SSE "data:" prefix if present
        const jsonStr = line.startsWith("data:") ? line.slice(5).trim() : line;
        if (!jsonStr || jsonStr === "[DONE]") continue;

        let event: { type: string; delta?: string; name?: string; input?: Record<string, unknown>; message?: string };
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (event.type === "text_delta" && event.delta) {
          store.getState().appendToLastMessage(event.delta);
        } else if (event.type === "tool_use" && event.name && event.input) {
          dispatchToolUse(store, { name: event.name, input: event.input });
        } else if (event.type === "error" && event.message) {
          store.getState().appendToLastMessage(`\n\n[Error: ${event.message}]`);
        }
        // "done" event: loop will exit naturally on stream close
      }
    }
  } finally {
    reader.releaseLock();
    store.getState().setLastMessageStreaming(false);
  }
}
