import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MockUIAgentProvider, runMockStream } from "../MockUIAgentProvider";
import { createMockStream } from "../createMockStream";
import { useAgentSnapshot } from "../useAgentSnapshot";
import { useModifiable } from "../../modifiable/useModifiable";
import { createAgentStore } from "../../provider/store";

// Helper: component that renders its modifiable text and exposes snapshot
function TextDisplay({ id }: { id: string }) {
  const { text, style, visible } = useModifiable(id, { text: "default" });
  if (!visible) return <span data-testid="hidden" />;
  return <span data-testid="text" style={style}>{text}</span>;
}

function SnapshotDisplay() {
  const snap = useAgentSnapshot();
  return (
    <div>
      <span data-testid="msg-count">{snap.messages.length}</span>
      <span data-testid="history-count">{snap.history.length}</span>
    </div>
  );
}

describe("MockUIAgentProvider — initialOverrides", () => {
  it("pre-seeds text override so useModifiable reads it immediately", () => {
    render(
      <MockUIAgentProvider
        initialOverrides={{ "hero": { text: "Mocked!" } }}
      >
        <TextDisplay id="hero" />
      </MockUIAgentProvider>
    );
    expect(screen.getByTestId("text").textContent).toBe("Mocked!");
  });

  it("pre-seeds style override", () => {
    render(
      <MockUIAgentProvider
        initialOverrides={{ "hero": { style: { color: "red" } } }}
      >
        <TextDisplay id="hero" />
      </MockUIAgentProvider>
    );
    expect(screen.getByTestId("text")).toHaveStyle({ color: "rgb(255, 0, 0)" });
  });

  it("pre-seeds visibility=false", () => {
    render(
      <MockUIAgentProvider
        initialOverrides={{ "hero": { visible: false } }}
      >
        <TextDisplay id="hero" />
      </MockUIAgentProvider>
    );
    expect(screen.getByTestId("hidden")).toBeInTheDocument();
    expect(screen.queryByTestId("text")).toBeNull();
  });
});

describe("MockUIAgentProvider — onApply", () => {
  it("fires onApply when an action is dispatched via useAgentSnapshot", async () => {
    const onApply = vi.fn();

    function Driver() {
      const snap = useAgentSnapshot();
      return (
        <button
          onClick={() =>
            snap.apply({ type: "setText", targetId: "hero", text: "Updated" })
          }
        >
          go
        </button>
      );
    }

    render(
      <MockUIAgentProvider onApply={onApply}>
        <TextDisplay id="hero" />
        <Driver />
      </MockUIAgentProvider>
    );

    await act(async () => {
      screen.getByText("go").click();
    });

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply.mock.calls[0][0]).toMatchObject({ type: "setText", text: "Updated" });
  });
});

describe("MockUIAgentProvider — initialMessages", () => {
  it("pre-seeds chat messages", () => {
    render(
      <MockUIAgentProvider
        initialMessages={[
          { id: "1", role: "user", content: "Hello" },
          { id: "2", role: "assistant", content: "Hi there" },
        ]}
      >
        <SnapshotDisplay />
      </MockUIAgentProvider>
    );
    expect(screen.getByTestId("msg-count").textContent).toBe("2");
  });
});

describe("runMockStream", () => {
  it("applies tool_use actions to the store", async () => {
    const store = createAgentStore();
    store.getState().register({ id: "title", tag: "h1", type: "text", currentText: "Hello" });

    const handler = createMockStream([
      { type: "tool_use", name: "setText", input: { targetId: "title", text: "From agent" } },
    ], { delayMs: 0 });

    await runMockStream(store, "change the title", handler);

    expect(store.getState().overrides["title"]?.text).toBe("From agent");
  });

  it("appends text_delta to assistant message", async () => {
    const store = createAgentStore();

    const handler = createMockStream([
      { type: "text_delta", delta: "Hello " },
      { type: "text_delta", delta: "world" },
    ], { delayMs: 0 });

    await runMockStream(store, "say something", handler);

    const messages = store.getState().messages;
    const assistant = messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Hello world");
  });

  it("builds undo history from tool actions", async () => {
    const store = createAgentStore();
    store.getState().register({ id: "btn", tag: "button", type: "element" });

    const handler = createMockStream([
      { type: "tool_use", name: "setVisibility", input: { targetId: "btn", visible: false } },
    ], { delayMs: 0 });

    await runMockStream(store, "hide the button", handler);

    expect(store.getState().history).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().overrides["btn"]?.visible).toBe(true);
  });

  it("stops at done event", async () => {
    const store = createAgentStore();

    const handler = createMockStream([
      { type: "text_delta", delta: "Before" },
      { type: "done" },
      { type: "text_delta", delta: "After" },
    ], { delayMs: 0 });

    await runMockStream(store, "test", handler);

    const assistant = store.getState().messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("Before");
  });

  it("marks assistant message as not streaming when done", async () => {
    const store = createAgentStore();
    const handler = createMockStream([], { delayMs: 0 });

    await runMockStream(store, "test", handler);

    const assistant = store.getState().messages.find((m) => m.role === "assistant");
    expect(assistant?.streaming).toBe(false);
  });
});

describe("useAgentSnapshot — apply", () => {
  it("exposes apply that updates store state reactively", async () => {
    function Fixture() {
      const snap = useAgentSnapshot();
      const { text } = useModifiable("item", { text: "original" });
      return (
        <div>
          <span data-testid="text">{text}</span>
          <span data-testid="history">{snap.history.length}</span>
          <button onClick={() => snap.apply({ type: "setText", targetId: "item", text: "changed" })}>
            apply
          </button>
        </div>
      );
    }

    render(
      <MockUIAgentProvider>
        <Fixture />
      </MockUIAgentProvider>
    );

    expect(screen.getByTestId("text").textContent).toBe("original");

    await act(async () => {
      screen.getByText("apply").click();
    });

    expect(screen.getByTestId("text").textContent).toBe("changed");
    expect(screen.getByTestId("history").textContent).toBe("1");
  });
});
