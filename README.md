# @faraday/ui-agent

A React SDK that lets users reshape your app's UI through a conversational agent — no redeploy required.

Engineers instrument their app with `<Modifiable>` elements and a provider. Users open a floating chat widget, describe what they want changed, and the agent modifies the interface while its response streams in.

## Installation

```bash
pnpm add @faraday/ui-agent
```

Peer dependencies: `react >=18`, `react-dom >=18`.

## Quick start

```tsx
import {
  UIAgentProvider,
  UIAgentLauncher,
  Modifiable,
  useModifiable,
} from "@faraday/ui-agent";
import "@faraday/ui-agent/dist/index.css";

function App() {
  return (
    <UIAgentProvider
      endpoint="/api/ui-agent"
      permissions={{
        allowedStyleProps: [
          "color",
          "background",
          "fontSize",
          "padding",
          "borderRadius",
        ],
        persist: "session",
      }}
    >
      <Hero />
      <UIAgentLauncher position="bottom-right" />
    </UIAgentProvider>
  );
}

function Hero() {
  const { text, style, visible } = useModifiable("hero-title", {
    text: "Welcome",
  });

  if (!visible) return null;
  return <h1 style={style}>{text}</h1>;
}
```

Or use the declarative wrapper:

```tsx
<Modifiable
  id="cta-button"
  as="button"
  defaultText="Sign up"
  onClick={handleSignup}
/>
```

## How elements are exposed to the agent

Only elements you explicitly mark are reachable. There are two ways:

**Hook** — use when you need the override values in your own render logic:

```tsx
const { text, style, visible } = useModifiable("hero-title", {
  text: "Welcome", // default text
  visible: true, // default visibility
});
```

**Component** — use for simple cases where you just want the element to be modifiable:

```tsx
<Modifiable id="hero-title" as="h1" defaultText="Welcome" />
```

Both register the element in the agent's page snapshot on mount and unregister on unmount.

## Provider options

```tsx
<UIAgentProvider
  endpoint="/api/ui-agent"            // required — your backend proxy URL
  components={{ Card, Alert }}        // optional — components the agent can insert
  permissions={{
    allowedStyleProps: [...],         // CSS properties the agent is allowed to set
    maxUndoDepth: 50,                 // undo history length (default: 50)
    persist: "none",                  // "none" | "session" | "user"
  }}
  onAction={(action) => {}}           // optional — called after each agent action
>
```

## Registering insertable components

If you want the agent to be able to insert new components (not just restyle existing ones), pass them in the `components` registry:

```tsx
<UIAgentProvider
  endpoint="/api/ui-agent"
  components={{
    Card: { component: Card, propsSchema: { title: "string", body: "string" } },
    Alert: { component: Alert, propsSchema: { variant: "info|warn|error", message: "string" } },
  }}
>
```

Mark the container where they should be inserted:

```tsx
<Modifiable id="sidebar" as="aside" type="container" />
```

## Backend endpoint

The SDK POSTs to your `endpoint` and expects a streaming response. Your backend is responsible for adding credentials and proxying to whichever LLM you use.

**Request body:**

```json
{
  "system": "<generated prompt with page snapshot>",
  "tools": [...],
  "messages": [{ "role": "user", "content": "Make the headline red" }]
}
```

**Response** — stream newline-delimited JSON (or SSE `data:` lines):

```
{ "type": "text_delta", "delta": "Making the headline red..." }
{ "type": "tool_use", "name": "applyStyle", "input": { "targetId": "hero-title", "properties": { "color": "#dc2626" } } }
{ "type": "done" }
```

Tool calls are applied to the page immediately as they arrive, before the stream finishes.

## Available agent tools

| Tool              | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `applyStyle`      | Set CSS properties on a modifiable element     |
| `setText`         | Change the text content of an element          |
| `setVisibility`   | Show or hide an element                        |
| `reorder`         | Reorder inserted components inside a container |
| `insertComponent` | Insert a registered component into a container |
| `undo`            | Revert the last N actions                      |

`applyStyle` only passes CSS keys listed in `allowedStyleProps` — everything else is dropped before it reaches the store.

## Development

```bash
pnpm build          # build to dist/
pnpm dev            # watch mode
pnpm test           # run tests (jsdom)
pnpm typecheck      # tsc --noEmit
```
