import { useLayoutEffect, useRef } from "react";

const DURATION_MS = 250;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * FLIP-animate the children of `containerEl` whose ids are listed in `childIds`.
 *
 * Captures each child's bounding rect on every render (post-commit). When the next
 * render arrives, computes the delta between the previous rect and the current rect
 * for ids present in both, and runs a transform animation on the element from
 * (oldOffset) → (0,0). Skips ids in `excludeIds` (the actively-dragged element,
 * whose transform is driven by pointer events).
 *
 * Respects `prefers-reduced-motion`.
 */
export function useFlipChildren(
  ref: React.RefObject<HTMLElement | null>,
  childIds: string[],
): void {
  const prevRects = useRef<Map<string, DOMRect>>(new Map());

  useLayoutEffect(() => {
    const containerEl = ref.current;
    if (!containerEl) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const newRects = new Map<string, DOMRect>();
    for (const id of childIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      newRects.set(id, rect);
    }

    if (!reduceMotion) {
      for (const [id, newRect] of newRects) {
        const el = document.getElementById(id);
        if (!el) continue;
        // Skip the actively-dragged element — its transform is driven by pointer events.
        if (el.dataset.faradayDragging === "true") continue;
        const oldRect = prevRects.current.get(id);
        if (!oldRect) continue;
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: DURATION_MS, easing: EASING, fill: "none" },
        );
      }
    }

    prevRects.current = newRects;
  });
}
