/**
 * Best-effort capture of the JSX file/line/column for a DOM element by walking
 * React's internal fiber tree. Returns `undefined` when:
 *   - The element isn't in a React tree we can find
 *   - React stripped `_debugSource` (production builds always do this)
 *   - The traversal walks past the root
 *
 * This is opt-in noise — never throw, never block rendering.
 */

export interface SourceLocation {
  fileName: string;
  lineNumber: number;
  columnNumber?: number;
}

interface FiberLike {
  _debugSource?: SourceLocation;
  return?: FiberLike;
}

/**
 * Find the React fiber attached to a DOM node. React stores it under a key
 * like `__reactFiber$<random>`; we have to look it up dynamically.
 */
function findFiber(el: HTMLElement): FiberLike | undefined {
  for (const key of Object.keys(el)) {
    if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
      return (el as unknown as Record<string, FiberLike>)[key];
    }
  }
  return undefined;
}

export function getElementSource(el: HTMLElement | null): SourceLocation | undefined {
  if (!el) return undefined;
  try {
    let fiber = findFiber(el);
    // Walk up the fiber tree — the host element fiber rarely has _debugSource;
    // it's the JSX expression's owner fiber that carries it.
    while (fiber) {
      if (fiber._debugSource) return fiber._debugSource;
      fiber = fiber.return;
    }
  } catch {
    // any traversal errors are non-fatal
  }
  return undefined;
}

/**
 * Truncated outerHTML for sending as live-DOM context. Strips long text content
 * to keep payloads small. Returns up to `maxLen` characters.
 */
export function getDomSnippet(el: HTMLElement | null, maxLen = 240): string | undefined {
  if (!el) return undefined;
  try {
    const html = el.outerHTML ?? "";
    if (html.length <= maxLen) return html;
    return html.slice(0, maxLen) + "…";
  } catch {
    return undefined;
  }
}
