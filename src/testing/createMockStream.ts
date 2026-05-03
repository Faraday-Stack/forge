import type { StreamEvent } from "../streaming/client";
import type { PageSnapshot } from "../types";

export type MockStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_use"; name: string; input: Record<string, unknown> }
  | { type: "error"; message: string }
  | { type: "done" };

export interface MockStreamOptions {
  /** Milliseconds to wait between events. Default: 30 */
  delayMs?: number;
}

export type MockStreamHandler = (
  userMessage: string,
  snapshot: PageSnapshot
) => AsyncIterable<StreamEvent>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a mock stream handler that replays a scripted sequence of events.
 * Pass the returned handler to MockUIAgentProvider's `mockHandler` prop.
 *
 * @example
 * const handler = createMockStream([
 *   { type: "text_delta", delta: "Making the headline red..." },
 *   { type: "tool_use", name: "applyStyle", input: { targetId: "hero", properties: { color: "red" } } },
 *   { type: "text_delta", delta: " Done!" },
 * ]);
 */
export function createMockStream(
  events: MockStreamEvent[],
  options: MockStreamOptions = {}
): MockStreamHandler {
  const { delayMs = 30 } = options;

  return function (_userMessage, _snapshot): AsyncIterable<StreamEvent> {
    let index = 0;

    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            if (index >= events.length) {
              return { done: true, value: undefined as unknown as StreamEvent };
            }

            if (delayMs > 0) await delay(delayMs);

            const event = events[index++];
            // "done" is a control sentinel — stop iteration without yielding
            if (event.type === "done") {
              return { done: true, value: undefined as unknown as StreamEvent };
            }

            return { done: false, value: event as StreamEvent };
          },
        };
      },
    };
  };
}
