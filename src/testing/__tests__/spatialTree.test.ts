import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createAgentStore } from "../../provider/store";
import { buildSpatialTree, renderTreeOutline } from "../../engine/spatialTree";

function setHTML(html: string) {
  document.body.innerHTML = html;
}

describe("buildSpatialTree", () => {
  let originalBody: string;
  beforeEach(() => {
    originalBody = document.body.innerHTML;
  });
  afterEach(() => {
    document.body.innerHTML = originalBody;
  });

  it("returns [] when document has no registered modifiables", () => {
    const store = createAgentStore();
    expect(buildSpatialTree(store)).toEqual([]);
  });

  it("builds a tree that follows DOM ancestry, not registration order", () => {
    setHTML(`
      <header>
        <h1 id="title">Hi</h1>
      </header>
      <main id="main">
        <p id="intro">Lead</p>
        <section id="cards">
          <div id="card-1">A</div>
          <div id="card-2">B</div>
        </section>
      </main>
    `);
    const store = createAgentStore();
    // Register in a deliberately scrambled order to prove tree comes from DOM, not insertion order.
    store.getState().register({ id: "card-2", tag: "div", type: "element" });
    store.getState().register({ id: "main", tag: "main", type: "container" });
    store.getState().register({ id: "title", tag: "h1", type: "text" });
    store.getState().register({ id: "card-1", tag: "div", type: "element" });
    store.getState().register({ id: "intro", tag: "p", type: "text" });
    store
      .getState()
      .register({ id: "cards", tag: "section", type: "container" });

    const tree = buildSpatialTree(store);
    // Top level: title (under header, no registered ancestor) and main.
    expect(tree.map((n) => n.id)).toEqual(["title", "main"]);
    const main = tree.find((n) => n.id === "main")!;
    expect(main.children.map((n) => n.id)).toEqual(["intro", "cards"]);
    const cards = main.children.find((n) => n.id === "cards")!;
    expect(cards.children.map((n) => n.id)).toEqual(["card-1", "card-2"]);
  });

  it("appends inserted components into their container nodes", () => {
    setHTML(`<div id="dropzone"></div>`);
    const store = createAgentStore();
    store
      .getState()
      .register({ id: "dropzone", tag: "div", type: "container" });
    store.getState().apply({
      type: "insertComponent",
      containerId: "dropzone",
      componentName: "FaradayBanner",
      props: { message: "Hi" },
      position: 0,
      instanceId: "inst_abc",
    });
    const tree = buildSpatialTree(store);
    const dropzone = tree.find((n) => n.id === "dropzone")!;
    expect(dropzone.children).toHaveLength(1);
    expect(dropzone.children[0]).toMatchObject({
      id: "inst_abc",
      tag: "FaradayBanner",
      isInserted: true,
    });
  });

  it("flags registry entries with no DOM element as unmounted at root level", () => {
    setHTML(""); // empty body
    const store = createAgentStore();
    store.getState().register({ id: "ghost", tag: "div", type: "element" });
    const tree = buildSpatialTree(store);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ id: "ghost", unmounted: true });
  });

  it("renderTreeOutline reflects nesting and tags", () => {
    setHTML(`
      <main id="main"><p id="intro">Hi</p></main>
    `);
    const store = createAgentStore();
    store.getState().register({ id: "main", tag: "main", type: "container" });
    store
      .getState()
      .register({ id: "intro", tag: "p", type: "text", currentText: "Hi" });
    const out = renderTreeOutline(buildSpatialTree(store));
    expect(out).toContain("- main (main) [container]");
    expect(out).toContain("  - intro (p)");
    expect(out).toContain('"Hi"');
  });
});
