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

describe("store.apply — applyStyle scope=descendants", () => {
  it("writes to descendantStyle, not style", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "red" },
      scope: "descendants",
    });
    expect(store.getState().overrides["sidebar"]?.descendantStyle?.color).toBe("red");
    expect(store.getState().overrides["sidebar"]?.style).toBeUndefined();
  });

  it("element scope leaves descendantStyle untouched", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "red" },
      scope: "descendants",
    });
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "blue" },
    });
    expect(store.getState().overrides["sidebar"]?.descendantStyle?.color).toBe("red");
    expect(store.getState().overrides["sidebar"]?.style?.color).toBe("blue");
  });

  it("undo restores descendantStyle to prior state", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "red" },
      scope: "descendants",
    });
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "blue" },
      scope: "descendants",
    });
    store.getState().undo(1);
    expect(store.getState().overrides["sidebar"]?.descendantStyle?.color).toBe("red");
  });

  it("snapshot exposes currentDescendantStyle", () => {
    const store = makeStore();
    store.getState().apply({
      type: "applyStyle",
      targetId: "sidebar",
      properties: { color: "red" },
      scope: "descendants",
    });
    const entry = store.getState().snapshot().modifiables.find((m) => m.id === "sidebar");
    expect(entry?.currentDescendantStyle?.color).toBe("red");
  });
});

describe("store.apply — setAttributes", () => {
  it("writes sanitized attributes", () => {
    const store = makeStore();
    const err = store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "/signup", target: "_blank", rel: "noopener" },
    });
    expect(err).toBeNull();
    const attrs = store.getState().overrides["btn"]?.attributes ?? {};
    expect(attrs.href).toBe("/signup");
    expect(attrs.target).toBe("_blank");
    expect(attrs.rel).toBe("noopener");
  });

  it("strips on* event handlers", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { onclick: "alert(1)", href: "/ok" },
    });
    const attrs = store.getState().overrides["btn"]?.attributes ?? {};
    expect(attrs.onclick).toBeUndefined();
    expect(attrs.href).toBe("/ok");
  });

  it("blocks javascript: URLs in href", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "javascript:alert(1)", title: "ok" },
    });
    const attrs = store.getState().overrides["btn"]?.attributes ?? {};
    expect(attrs.href).toBeUndefined();
    expect(attrs.title).toBe("ok");
  });

  it("drops attributes outside the allowlist", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { class: "danger", id: "new-id" },
    });
    const attrs = store.getState().overrides["btn"]?.attributes;
    expect(attrs).toBeUndefined();
  });

  it("returns error when nothing survives sanitization", () => {
    const store = makeStore();
    const err = store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { onclick: "x", style: "color:red" },
    });
    expect(err).toMatch(/no allowed attributes/);
  });

  it("empty string clears the attribute on next set", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "/a" },
    });
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "" },
    });
    const attrs = store.getState().overrides["btn"]?.attributes ?? {};
    expect(attrs.href).toBeUndefined();
  });

  it("undo restores prior attribute values", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "/a" },
    });
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "/b" },
    });
    store.getState().undo(1);
    expect(store.getState().overrides["btn"]?.attributes?.href).toBe("/a");
  });

  it("undo of first setAttributes clears the attribute", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { href: "/a" },
    });
    store.getState().undo(1);
    expect(store.getState().overrides["btn"]?.attributes?.href).toBeUndefined();
  });

  it("aria-* and data-* are accepted by the default allowlist", () => {
    const store = makeStore();
    store.getState().apply({
      type: "setAttributes",
      targetId: "btn",
      attributes: { "aria-label": "Save", "data-test": "btn-save" },
    });
    const attrs = store.getState().overrides["btn"]?.attributes ?? {};
    expect(attrs["aria-label"]).toBe("Save");
    expect(attrs["data-test"]).toBe("btn-save");
  });
});

describe("store.apply — removeComponent / removeInjection", () => {
  function setup() {
    const store = makeStore();
    store.getState().apply({
      type: "insertComponent",
      containerId: "sidebar",
      componentName: "FaradayBanner",
      props: { text: "hi" },
      position: 0,
      instanceId: "comp-1",
    });
    store.getState().apply({
      type: "injectHTML",
      targetId: "btn",
      html: "<span>x</span>",
      position: "after",
      injectionId: "inj-1",
    });
    return store;
  }

  it("removeComponent deletes from insertedComponents", () => {
    const store = setup();
    const err = store.getState().apply({ type: "removeComponent", instanceId: "comp-1" });
    expect(err).toBeNull();
    expect(store.getState().insertedComponents["sidebar"]).toEqual([]);
  });

  it("removeComponent unknown instanceId returns error", () => {
    const store = makeStore();
    const err = store.getState().apply({ type: "removeComponent", instanceId: "nope" });
    expect(err).toMatch(/not found/);
  });

  it("removeInjection deletes from injections", () => {
    const store = setup();
    const err = store.getState().apply({
      type: "removeInjection",
      targetId: "btn",
      injectionId: "inj-1",
    });
    expect(err).toBeNull();
    expect(store.getState().injections["btn"]).toEqual([]);
  });

  it("removeInjection unknown injectionId returns error", () => {
    const store = setup();
    const err = store.getState().apply({
      type: "removeInjection",
      targetId: "btn",
      injectionId: "nope",
    });
    expect(err).toMatch(/not on target/);
  });

  it("undo of removeComponent re-inserts at original position", () => {
    const store = setup();
    store.getState().apply({ type: "removeComponent", instanceId: "comp-1" });
    store.getState().undo(1);
    const list = store.getState().insertedComponents["sidebar"] ?? [];
    expect(list).toHaveLength(1);
    expect(list[0].instanceId).toBe("comp-1");
    expect(list[0].componentName).toBe("FaradayBanner");
  });

  it("undo of removeInjection re-creates the injection", () => {
    const store = setup();
    store.getState().apply({
      type: "removeInjection",
      targetId: "btn",
      injectionId: "inj-1",
    });
    store.getState().undo(1);
    const list = store.getState().injections["btn"] ?? [];
    expect(list).toHaveLength(1);
    expect(list[0].injectionId).toBe("inj-1");
    expect(list[0].html).toBe("<span>x</span>");
  });
});

describe("vibePreferences — extraction across turns", () => {
  it("starts empty", () => {
    const store = makeStore();
    expect(store.getState().vibePreferences.tags).toEqual({});
  });

  it("tracks tone tags from user messages", () => {
    const store = makeStore();
    store.getState().observeUserMessage("make this feel warmer and more bold");
    const tags = store.getState().vibePreferences.tags;
    expect(tags.warm).toBe(1);
    expect(tags.bold).toBe(1);
  });

  it("ignores messages with no tonal vocabulary", () => {
    const store = makeStore();
    store.getState().observeUserMessage("add a chart of the revenue data");
    expect(store.getState().vibePreferences.tags).toEqual({});
    expect(store.getState().vibePreferences.lastTonalRequest).toBeNull();
  });

  it("accumulates frequencies across turns", () => {
    const store = makeStore();
    store.getState().observeUserMessage("make this warmer");
    store.getState().observeUserMessage("warmer still, like a sunset");
    expect(store.getState().vibePreferences.tags.warm).toBe(2);
  });

  it("records last tonal request verbatim", () => {
    const store = makeStore();
    store.getState().observeUserMessage("add a chart");
    store.getState().observeUserMessage("now make it feel cozy and minimalist");
    expect(store.getState().vibePreferences.lastTonalRequest).toMatch(/cozy/);
  });

  it("recognises product-style references (linear, notion)", () => {
    const store = makeStore();
    store.getState().observeUserMessage("make this feel like linear");
    expect(store.getState().vibePreferences.tags.linear).toBe(1);
  });
});

describe("snapshot — exposes injections", () => {
  it("includes injections keyed by targetId", () => {
    const store = makeStore();
    store.getState().apply({
      type: "injectHTML",
      targetId: "btn",
      html: "<i>i</i>",
      position: "after",
      injectionId: "inj-snap",
    });
    const snap = store.getState().snapshot();
    expect(snap.injections["btn"]).toHaveLength(1);
    expect(snap.injections["btn"][0].injectionId).toBe("inj-snap");
  });
});
