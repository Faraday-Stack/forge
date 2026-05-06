# IMPROVEMENTS.md

Living roadmap for the `@faraday-stack/forge` package. Order roughly reflects priority — the highest-impact, most-frequently-hit issues sit at the top.

---

## 1. Spatial insertion has only one drop target

**Problem.** The agent can only `insertComponent` into a Modifiable whose `type="container"`. In a real host app there are usually only one or two such containers, so spatial requests like *"add a banner below the social-proof bar"* always collapse to the same slot regardless of where the user pointed. The agent looks broken; in reality the package can't fulfill the request.

**Status: option 3 implemented as a stopgap.** The system prompt in `engine/snapshot.ts` now includes a strict decision procedure plus end-user-friendly refusal copy ("Sorry — the developers have only given me access to adding components just under the navigation…") so the agent declines and offers real alternatives instead of dumping into the wrong slot. The underlying limitation remains — options 1 and 2 below are still pending for a real fix.

**Options:**

1. **Auto-slot every Modifiable** *(recommended)*. Every `<Modifiable>` implicitly exposes `${id}.before` and `${id}.after` as virtual container ids. The Modifiable wraps itself in `<>{beforeSlot}<Tag>…</Tag>{afterSlot}</>`. The spatial tree advertises both slots. The agent's "below X" maps cleanly to `${X}.after`.
   - Pros: matches the user's mental model exactly; no new tool.
   - Cons: every Modifiable gets two extra registry entries (3× registry size); empty slots may need `display: contents` to avoid disturbing flex/grid parents; opt-out flag (`autoSlots={false}`) for hosts that need pixel-tight layouts.
2. **New `insertSibling(targetId, position, componentName, props)` tool.** Standalone action; implementation still needs option 1's slot rendering under the hood.
   - Pros: explicit semantics in the tool surface.
   - Cons: more API; not strictly different from option 1 from the host side.
3. ~~**Sharper prompt only.**~~ ✅ Done. Agent now refuses gracefully and surfaces available slots in plain language. Doesn't actually expand insertion targets, so options 1/2 still needed.
4. **Document host responsibility.** Tell host authors to scatter `<Modifiable type="container" />` around their JSX.
   - Pros: free; correct today.
   - Cons: punts the problem to every host author; defeats "drop in and let the agent compose UI."

**Recommendation:** Option 1 with opt-out (still the right end state).

---

## 2. Click-to-edit popover can't truly remove an override

**Problem.** `EditPopover.reset()` in `widget/InlineEditOverlay.tsx` clears overridden style keys by setting them to `""`. The override map keeps the key with an empty value rather than dropping it, so the next agent action sees a bogus "previous value" of `""` instead of the original style. Inverse undo also captures `""` instead of the real prior state.

**Fix.** Add a `clearOverride` action (or a `properties: null` signal in `applyStyle`) that removes keys from `overrides[id].style` outright. Update `apply()` and the inverse-history machinery in `provider/store.ts` to round-trip removal as a real distinct operation.

---

## 3. `FaradayForm` doesn't guard duplicate `formId`

**Problem.** Two `FaradayForm`s with the same `formId` would both register a Modifiable container with that id, clobbering the first registration silently. We scaffolded the check then removed it because the registry can't distinguish "this form's div" from "a sibling's." Today the user just sees React's duplicate-DOM-id warning in the console.

**Fix.** Track form ownership inside `FaradayForm` via `useEffect` + a small in-memory set keyed off the agent store. If the id is already claimed by another instance, render an inline error instead of double-registering.

---

## 4. Form values aren't surfaced to the agent

**Problem.** When the user fills in a `FaradayForm`, the values live in the DOM until submit. The agent can't see what the user is typing, so it can't say *"want me to add an address field below the email?"* in response to context.

**Decision needed.** Do we want the agent to read live form state? If yes, the field components need to become controlled (or shadow-controlled via `onInput` handlers writing into the store). Adds chat-context volume — every keystroke is a state change. Probably gated behind `<UIAgentProvider observeForms>` or similar.

---

## 5. Drag-to-reorder is sibling-only

**Problem.** `useDragHandle` only fires `reorder` within the original parent container. You can't drag a Modifiable into a *different* parent. For the landing-page demo that's a non-issue (only one container). For a dashboard with multiple drop zones it'd be a real limitation.

**Fix.** Extend the hit-test in `useDragHandle.ts` to walk all `[data-faraday-container]` elements during drag, not just the source's siblings. On drop into a different container, dispatch a new `move(targetId, fromContainer, toContainer, position)` action. Store needs to track moves as a distinct InverseAction so undo round-trips correctly.

Pairs with #1 — once auto-slots exist, every Modifiable becomes a drop zone, which is probably the right end state.

---

## 6. Self-hosted mode lingering in the code

**Context.** Memory note says faraday is going SaaS-only and the `endpoint` path is being removed. Today the code branches on `publishableKey` vs `endpoint` in `streaming/client.ts:17` and `UIAgentProvider.tsx:35`. Tests, types, and provider props all carry both modes.

**Fix.** Delete the `endpoint` mode from `AgentConnectionConfig`, `streamAgentResponse`, `streamInlineEdit`, and the provider's runtime check. Update demos accordingly. Pure cleanup; no behavioral change for SaaS users.

---

## 7. Allowed-style-prop list is small

**Problem.** `DEFAULT_PERMISSIONS.allowedStyleProps` in `provider/store.ts:17` covers ~25 properties. The agent regularly tries `transform`, `flexDirection`, `alignItems`, `justifyContent`, `width`, `height` — all silently dropped. Users see "the agent did nothing" without knowing why.

**Fix.** Either expand the list significantly (most properties are not security-sensitive — `url()` and `expression()` are guarded at the value level by the sanitizer, not the property level), or surface a warning back to the agent when a property is filtered so it can recover. Probably both.

---

## 8. Reduced motion is partial

**Problem.** Pulse and FLIP both check `prefers-reduced-motion`, but the highlight pulsate (`widget.module.css :345`) uses a CSS animation that doesn't. Inconsistent.

**Fix.** Add a `@media (prefers-reduced-motion: reduce) { .modifiableHighlightPulsing { animation: none; } }` block, and audit any other CSS animations.

---

## 9. No keyboard affordance for drag

**Problem.** Drag is pointer-only. Keyboard users can't reorder.

**Fix.** When a Modifiable is focused via Tab, `Cmd/Ctrl + ArrowUp/Down` could dispatch `reorder` to move it among siblings. Cheap; matches GitHub/Notion idioms.

---

## 11. Removed `UIAgentLauncher` export

**Status: done.** The `UIAgentLauncher` component was already a no-op stub — the chat UI is auto-mounted by `UIAgentProvider` via `InlineEditOverlay`. Deleted `src/widget/UIAgentLauncher.tsx`, dropped the export from `src/index.ts`, and cleared all references from the README, demos, and CLAUDE.md. **Breaking change** for any external consumer importing the symbol; merits a minor version bump.

---

## 10. The chat panel doesn't show inserted instances by id

**Problem.** When the user says "remove the welcome card," the agent has to guess which `instance_AbCd` that refers to. The spatial tree shows `[inserted FaradayCard]` but doesn't include the rendered props (e.g. `title="Welcome"`).

**Fix.** Include a short props summary in the spatial-tree rendering of inserted nodes — e.g. `[inserted FaradayCard "Welcome"]` derived from the first string-valued prop. Already half-done in `engine/spatialTree.ts`; just extend the formatter.

---

## Quick-win triage

For a focused short sprint, I'd take these in order:

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | Auto-slot every Modifiable | M | High — unblocks every spatial request |
| 7 | Expand allowed style props + agent feedback | S | High — fixes silent no-ops |
| 10 | Inserted-instance props in tree | S | Medium — improves "remove the X" |
| 2 | True override removal | S | Medium — fixes inverse correctness |
| 6 | Delete self-hosted code paths | S | Low — pure cleanup |

The rest are good follow-ons but less urgent.
