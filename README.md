# @faraday-stack/forge

A React SDK that lets users reshape your app's UI through a conversational agent — no redeploy required.

Engineers instrument their app with `<Modifiable>` elements and a provider. Users open a floating chat widget, describe
what they want changed, and the agent modifies the interface while its response streams in. All requests are routed
through the Faraday SaaS backend — you don't run any agent infrastructure yourself.

## Installation

```bash
pnpm add @faraday-stack/forge
```

Peer dependencies: `react >=18`, `react-dom >=18`.

## Quick start

```tsx
import {
  UIAgentProvider,
  UIAgentLauncher,
  Modifiable,
  useModifiable,
} from "@faraday-stack/forge";
import "@faraday-stack/forge/style.css";

function App() {
  return (
    <UIAgentProvider
      publishableKey={import.meta.env.VITE_FARADAY_PUBLISHABLE_KEY}
      userToken={currentUser.faradayToken}
      permissions={{
        allowedStyleProps: [
          "color",
          "background",
          "fontSize",
          "padding",
          "borderRadius",
        ],
        persist: "user",
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

## Authenticating the provider

`UIAgentProvider` requires two credentials:

| Prop             | Where it comes from                        | Notes                                                                                       |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `publishableKey` | Faraday dashboard → **Project → API keys** | Safe to ship in client bundles. Identifies your project, not your users.                    |
| `userToken`      | Your backend, minted per logged-in user    | Short-lived JWT scoped to a single user. Mint it server-side and pass it to the React tree. |

```tsx
<UIAgentProvider
  publishableKey="pk_live_…" // public, ships with the bundle
  userToken={session.faradayToken} // private, minted per user on your backend
>
  {children}
</UIAgentProvider>
```

The provider throws at mount if `publishableKey` is missing, or if `publishableKey` is set without a `userToken` —
both are required.

### Getting a publishable key

1. Sign in at [app.faraday.dev](https://app.faraday.dev).
2. Create or select a project.
3. Open **API keys** and copy the value prefixed with `pk_live_` (production) or `pk_test_` (test mode).
4. Put it in an env var your bundler exposes to the client (e.g. `VITE_FARADAY_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_FARADAY_PUBLISHABLE_KEY`).

### Minting a user token

User tokens are short-lived JWTs you generate on your backend using your **secret key** (kept server-side, never
shipped). A typical flow:

```ts
// server — e.g. /api/faraday/token
import { mintUserToken } from "@faraday/server";

app.get("/api/faraday/token", requireAuth, async (req, res) => {
  const token = await mintUserToken({
    secretKey: process.env.FARADAY_SECRET_KEY!,
    userId: req.user.id,
    // optional: claims surfaced to the agent (org, role, plan, …)
    claims: { orgId: req.user.orgId, role: req.user.role },
  });
  res.json({ token });
});
```

Fetch the token after login and feed it to the provider. Refresh it on a timer or when the SDK reports an expired token.

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
  publishableKey="pk_live_…"          // required — your project's publishable key
  userToken={session.faradayToken}    // required — short-lived per-user JWT
  components={{ Card, Alert }}        // optional — components the agent can insert
  permissions={{
    allowedStyleProps: [...],         // CSS properties the agent is allowed to set
    maxUndoDepth: 50,                 // undo history length (default: 50)
    persist: "none",                  // "none" | "session" | "user"
  }}
  onAction={(action) => {}}           // optional — called after each agent action
>
```

`persist: "user"` saves overrides to the Faraday backend keyed by `userToken`, so they follow the user across devices.
`persist: "session"` keeps them in `sessionStorage`. `persist: "none"` discards on reload.

## Registering insertable components

If you want the agent to be able to insert new components (not just restyle existing ones), pass them in the
`components` registry:

```tsx
<UIAgentProvider
  publishableKey={import.meta.env.VITE_FARADAY_PUBLISHABLE_KEY}
  userToken={session.faradayToken}
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

## Available agent tools

| Tool              | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `applyStyle`      | Set CSS properties on a modifiable element     |
| `setText`         | Change the text content of an element          |
| `setVisibility`   | Show or hide an element                        |
| `reorder`         | Reorder inserted components inside a container |
| `insertComponent` | Insert a registered component into a container |
| `undo`            | Revert the last N actions                      |

`applyStyle` only passes CSS keys listed in `allowedStyleProps` — everything else is dropped before it reaches the
store.

## Development

```bash
pnpm build          # build to dist/
pnpm dev            # watch mode
pnpm test           # run tests (jsdom)
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint src
pnpm lint:publish   # publint — validates published metadata
pnpm check:exports  # arethetypeswrong — validates dist resolution
```

## Releasing

Releases are driven by [Changesets](https://github.com/changesets/changesets). When you make a user-visible change to this package:

```bash
pnpm changeset
```

Pick `patch`, `minor`, or `major` and write a one-line consumer-facing summary. Commit the generated `.changeset/*.md` file with your PR.

After your PR merges to `main`, the `release` workflow opens (or updates) a **Version Packages** PR that bumps `package.json` and rewrites `CHANGELOG.md`. Merging that PR publishes to npm with provenance and creates a GitHub Release. No manual `npm publish` needed.
