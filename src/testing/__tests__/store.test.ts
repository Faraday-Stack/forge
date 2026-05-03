import { describe, it, expect } from "vitest";
import { createAgentStore } from "../../provider/store";

function makeStore() {
  const store = createAgentStore();
  store.getState().register({ id: "title", tag: "h1", type: "text", currentText: "Hello" });
  store.getState().register({ id: "btn", tag: "button", type: "element" });
  store.getState().register({ id: "sidebar", tag: "aside", type: "container" });
  return store;
}

describe("store.apply — setText", () => {
  it("sets text override", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "World" });
    expect(store.getState().overrides["title"]?.text).toBe("World");
  });

  it("stores inverse with previous text from registry", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "World" });
    expect(store.getState().history[0][0]).toEqual({
      type: "setText",
      targetId: "title",
      text: "Hello",
    });
  });

  it("stores inverse with previous text from override when already overridden", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "First" });
    store.getState().apply({ type: "setText", targetId: "title", text: "Second" });
    expect(store.getState().history[0][0]).toEqual({
      type: "setText",
      targetId: "title",
      text: "First",
    });
  });

  it("returns error for unknown targetId", () => {
    const store = makeStore();
    const err = store.getState().apply({ type: "setText", targetId: "nope", text: "x" });
    expect(err).toMatch(/Unknown targetId/);
  });
});

describe("store.apply — applyStyle", () => {
  it("merges style override", () => {
    const store = makeStore();
    store.getState().apply({ type: "applyStyle", targetId: "title", properties: { color: "red" } });
    expect(store.getState().overrides["title"]?.style?.color).toBe("red");
  });

  it("drops disallowed CSS properties", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "title",
      properties: { color: "red", position: "fixed" as never },
    });
    const style = store.getState().overrides["title"]?.style ?? {};
    expect("position" in style).toBe(false);
    expect(style.color).toBe("red");
  });

  it("drops CSS injection attempts", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "title",
      properties: { color: "url(javascript:alert(1))" },
    });
    // color is allowed but value contains blocked pattern — sanitize drops it
    const style = store.getState().overrides["title"]?.style ?? {};
    expect(style.color).toBeUndefined();
  });
});

describe("store.apply — setVisibility", () => {
  it("hides element", () => {
    const store = makeStore();
    store.getState().apply({ type: "setVisibility", targetId: "btn", visible: false });
    expect(store.getState().overrides["btn"]?.visible).toBe(false);
  });

  it("stores inverse visibility", () => {
    const store = makeStore();
    store.getState().apply({ type: "setVisibility", targetId: "btn", visible: false });
    expect(store.getState().history[0][0]).toEqual({
      type: "setVisibility",
      targetId: "btn",
      visible: true,
    });
  });
});

describe("store.apply — insertComponent", () => {
  it("inserts component into container", () => {
    const store = makeStore();
    store.getState().apply({
      type: "insertComponent",
      containerId: "sidebar",
      componentName: "Card",
      props: { title: "Hi" },
      position: 0,
      instanceId: "inst-1",
    });
    const inserted = store.getState().insertedComponents["sidebar"];
    expect(inserted).toHaveLength(1);
    expect(inserted[0].instanceId).toBe("inst-1");
    expect(inserted[0].componentName).toBe("Card");
  });
});

describe("store.undo", () => {
  it("reverts setText", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "Changed" });
    store.getState().undo();
    expect(store.getState().overrides["title"]?.text).toBe("Hello");
  });

  it("reverts multiple steps", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "A" });
    store.getState().apply({ type: "setText", targetId: "title", text: "B" });
    store.getState().undo(2);
    expect(store.getState().overrides["title"]?.text).toBe("Hello");
  });

  it("removes inverse from history after undo", () => {
    const store = makeStore();
    store.getState().apply({ type: "setText", targetId: "title", text: "A" });
    expect(store.getState().history).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().history).toHaveLength(0);
  });

  it("reverts insertComponent", () => {
    const store = makeStore();
    store.getState().apply({
      type: "insertComponent",
      containerId: "sidebar",
      componentName: "Card",
      props: {},
      position: 0,
      instanceId: "inst-1",
    });
    store.getState().undo();
    expect(store.getState().insertedComponents["sidebar"] ?? []).toHaveLength(0);
  });
});

describe("store.snapshot", () => {
  it("includes all registered elements", () => {
    const store = makeStore();
    const snap = store.getState().snapshot();
    const ids = snap.modifiables.map((m) => m.id);
    expect(ids).toContain("title");
    expect(ids).toContain("btn");
    expect(ids).toContain("sidebar");
  });

  it("reflects current style overrides", () => {
    const store = makeStore();
    store.getState().apply({ type: "applyStyle", targetId: "title", properties: { color: "blue" } });
    const snap = store.getState().snapshot();
    const entry = snap.modifiables.find((m) => m.id === "title");
    expect(entry?.currentStyle?.color).toBe("blue");
  });
});

describe("store.apply — onAction callback", () => {
  it("fires callback with dispatched action", () => {
    const store = makeStore();
    const calls: unknown[] = [];
    store.getState().apply(
      { type: "setText", targetId: "title", text: "CB" },
      (a) => calls.push(a)
    );
    expect(calls).toHaveLength(1);
    expect((calls[0] as { type: string }).type).toBe("setText");
  });
});
