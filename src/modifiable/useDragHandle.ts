import { useEffect, useRef } from "react";
import type { AgentStore } from "../provider/store";

const BORDER_PX = 8;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
}

/**
 * Wires border-hover drag-to-reorder behavior onto a Modifiable element.
 *
 * - Hovering near the edge (`BORDER_PX`) reveals a grab cursor + outline.
 * - Pressing on the edge starts a drag: element gets translated by pointer delta.
 * - On pointerup, hit-tests siblings to determine the new slot, then dispatches
 *   `reorder` through the store. Releases pointer capture and clears local state.
 * - If `containerId` is missing, the hook short-circuits — only children of a
 *   container can be reordered.
 */
export function useDragHandle(
  ref: React.RefObject<HTMLElement | null>,
  id: string,
  containerId: string | undefined,
  store: AgentStore,
): void {
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !containerId) return;

    function nearBorder(e: PointerEvent, target: HTMLElement): boolean {
      const r = target.getBoundingClientRect();
      const dx = Math.min(e.clientX - r.left, r.right - e.clientX);
      const dy = Math.min(e.clientY - r.top, r.bottom - e.clientY);
      return dx >= 0 && dy >= 0 && Math.min(dx, dy) <= BORDER_PX;
    }

    function onPointerMoveHover(e: PointerEvent) {
      if (dragRef.current) return;
      const target = el!;
      if (nearBorder(e, target)) {
        target.dataset.faradayGrabbable = "true";
      } else {
        delete target.dataset.faradayGrabbable;
      }
    }

    function onPointerLeave() {
      if (dragRef.current) return;
      delete el!.dataset.faradayGrabbable;
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const target = el!;
      if (!nearBorder(e, target)) return;
      e.preventDefault();
      e.stopPropagation();
      target.setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: target.getBoundingClientRect().left,
        origTop: target.getBoundingClientRect().top,
      };
      target.dataset.faradayDragging = "true";
      target.style.transition = "none";
      target.style.zIndex = "2147483640";
    }

    function onPointerMoveDrag(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      el!.style.transform = `translate(${dx}px, ${dy}px)`;
      el!.style.opacity = "0.85";
      el!.style.pointerEvents = "none";
    }

    function endDrag(e: PointerEvent, commit: boolean) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const target = el!;
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        // ignore — capture may already be released
      }

      if (commit) {
        const containerEl = document.getElementById(containerId!);
        if (containerEl) {
          const siblings = collectSiblings(containerEl, id);
          // Find drop index by pointer position vs. sibling midpoints
          const dropIndex = findDropIndex(siblings, e.clientX, e.clientY);
          const newOrder = siblings.map((s) => s.id);
          newOrder.splice(dropIndex, 0, id);
          store
            .getState()
            .apply({
              type: "reorder",
              containerId: containerId!,
              order: newOrder,
            });
        }
      }

      // Clear inline transforms — FLIP will pick up the actual movement.
      target.style.transform = "";
      target.style.opacity = "";
      target.style.pointerEvents = "";
      target.style.transition = "";
      target.style.zIndex = "";
      delete target.dataset.faradayDragging;
      delete target.dataset.faradayGrabbable;
      dragRef.current = null;
    }

    function onPointerUp(e: PointerEvent) {
      endDrag(e, true);
    }
    function onPointerCancel(e: PointerEvent) {
      endDrag(e, false);
    }

    el.addEventListener("pointermove", onPointerMoveHover);
    el.addEventListener("pointerleave", onPointerLeave);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMoveDrag);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);

    return () => {
      el.removeEventListener("pointermove", onPointerMoveHover);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMoveDrag);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
      delete el.dataset.faradayGrabbable;
      delete el.dataset.faradayDragging;
    };
  }, [ref, id, containerId, store]);
}

interface SiblingRect {
  id: string;
  rect: DOMRect;
}

function collectSiblings(
  containerEl: HTMLElement,
  excludeId: string,
): SiblingRect[] {
  const result: SiblingRect[] = [];
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      const childEl = child as HTMLElement;
      if (childEl.id && childEl.id !== excludeId) {
        const rect = childEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          result.push({ id: childEl.id, rect });
        }
      }
    }
  };
  walk(containerEl);
  return result;
}

function findDropIndex(siblings: SiblingRect[], x: number, y: number): number {
  // For each sibling, check if pointer is past its midpoint along the dominant axis.
  // We use vertical-flow as default and fall back to horizontal if siblings are
  // arranged side-by-side (detected by comparing y vs x range).
  if (siblings.length === 0) return 0;

  // Determine flow: if any two consecutive siblings overlap vertically more than
  // they overlap horizontally, treat as horizontal flow.
  let horizontal = false;
  for (let i = 1; i < siblings.length; i++) {
    const a = siblings[i - 1].rect;
    const b = siblings[i].rect;
    const verticalOverlap = Math.max(
      0,
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
    );
    if (verticalOverlap > Math.min(a.height, b.height) * 0.5) {
      horizontal = true;
      break;
    }
  }

  for (let i = 0; i < siblings.length; i++) {
    const r = siblings[i].rect;
    const mid = horizontal ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    const cursor = horizontal ? x : y;
    if (cursor < mid) return i;
  }
  return siblings.length;
}
