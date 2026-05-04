import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import {
  useFloating,
  offset,
  shift,
  flip,
  autoUpdate,
} from "@floating-ui/react";
import { useAgentStore } from "../provider/context";
import { ChatPanel } from "./ChatPanel";
import styles from "./widget.module.css";

/**
 * Auto-mounted by `UIAgentProvider`. Default state: a single orange dot at the
 * top-right corner of the *topmost* registered Modifiable. Click → opens the
 * full chat panel anchored to the dot AND highlights every modifiable element
 * on the page so the user can see what's editable.
 */
export function InlineEditOverlay() {
  const store = useAgentStore();
  const registry = useStore(store, (s) => s.registry);
  const pulsingIds = useStore(store, (s) => s.pulsingIds);
  const [collapsed, setCollapsed] = useState(true);
  const [dotPos, setDotPos] = useState<{ top: number; left: number } | null>(null);
  const [allRects, setAllRects] = useState<Record<string, DOMRect>>({});
  const [panelRect, setPanelRect] = useState<DOMRect | null>(null);
  const [userMoved, setUserMoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dotRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const userMovedRef = useRef(false);
  const dotPosRef = useRef<{ top: number; left: number } | null>(null);

  useEffect(() => {
    userMovedRef.current = userMoved;
  }, [userMoved]);
  useEffect(() => {
    dotPosRef.current = dotPos;
  }, [dotPos]);

  // Floating UI: anchor the chat panel below-right of the dot, with viewport flip
  const { refs, floatingStyles } = useFloating({
    placement: "bottom-end",
    middleware: [offset(12), shift({ padding: 16 }), flip()],
    open: !collapsed,
    whileElementsMounted: autoUpdate,
  });

  // Track positions: rect of every Modifiable (for highlights) + dot anchor
  // (top-right of the topmost one). Recomputed on layout drift.
  useEffect(() => {
    const ids = Object.keys(registry).filter((id) => !id.startsWith("__"));

    function recompute() {
      const next: Record<string, DOMRect> = {};
      let topY = Infinity;
      let topRect: DOMRect | null = null;

      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        next[id] = rect;
        const absTop = rect.top + window.scrollY;
        if (absTop < topY) {
          topY = absTop;
          topRect = rect;
        }
      }

      setAllRects(next);

      const panelEl = refs.floating.current;
      setPanelRect(panelEl ? panelEl.getBoundingClientRect() : null);

      if (userMovedRef.current) {
        const cur = dotPosRef.current;
        if (cur) {
          const dotSize = 32;
          const maxLeft = window.innerWidth - dotSize - 8;
          const maxTop = window.innerHeight - dotSize - 8;
          const clampedLeft = Math.max(8, Math.min(maxLeft, cur.left));
          const clampedTop = Math.max(8, Math.min(maxTop, cur.top));
          if (clampedLeft !== cur.left || clampedTop !== cur.top) {
            setDotPos({ top: clampedTop, left: clampedLeft });
          }
        }
        return;
      }

      if (topRect) {
        const dotSize = 32;
        setDotPos({
          top: Math.max(8, topRect.top - dotSize / 2),
          left: Math.min(
            window.innerWidth - dotSize - 8,
            topRect.right - dotSize / 2,
          ),
        });
      } else {
        setDotPos(null);
      }
    }

    recompute();

    const ro = new ResizeObserver(recompute);
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) ro.observe(el);
    }
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    const interval = window.setInterval(recompute, 750);

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
      window.clearInterval(interval);
    };
  }, [registry]);

  const setDotRef = useCallback(
    (el: HTMLButtonElement | null) => {
      dotRef.current = el;
      refs.setReference(el);
    },
    [refs],
  );

  const onClose = useCallback(() => setCollapsed(true), []);

  const DRAG_THRESHOLD = 4;
  const DOT_SIZE = 32;

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const cur = dotPosRef.current;
    if (!cur) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - cur.left,
      offsetY: e.clientY - cur.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
      setUserMoved(true);
    }
    const maxLeft = window.innerWidth - DOT_SIZE - 8;
    const maxTop = window.innerHeight - DOT_SIZE - 8;
    const left = Math.max(8, Math.min(maxLeft, e.clientX - drag.offsetX));
    const top = Math.max(8, Math.min(maxTop, e.clientY - drag.offsetY));
    setDotPos({ top, left });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const wasDrag = drag.moved;
    dragRef.current = null;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — capture may have already been released
    }
    if (!wasDrag) {
      setCollapsed((v) => !v);
    }
  }, []);

  const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  }, []);

  if (!dotPos) return null;

  return createPortal(
    <div data-faraday>
      <button
        ref={setDotRef}
        type="button"
        className={styles.floatingExpandBtn}
        style={{ top: dotPos.top, left: dotPos.left }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        data-dragging={dragging ? "true" : undefined}
        aria-label={collapsed ? "Open Faraday editor" : "Close Faraday editor"}
        aria-expanded={!collapsed}
        title="Drag to move, click to open Faraday editor"
      >
        {collapsed ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        )}
      </button>

      {!collapsed && (
        <>
          {/* Highlights: outline every modifiable so the user sees what they can edit */}
          {Object.entries(allRects).map(([id, rect]) => {
            const labelPos = pickLabelPosition(id, rect, panelRect, dotPos);
            return (
              <div
                key={pulsingIds[id] ? `${id}:${pulsingIds[id]}` : id}
                className={
                  pulsingIds[id]
                    ? `${styles.modifiableHighlight} ${styles.modifiableHighlightPulsing}`
                    : styles.modifiableHighlight
                }
                style={{
                  position: "fixed",
                  top: rect.top - 2,
                  left: rect.left - 2,
                  width: rect.width + 4,
                  height: rect.height + 4,
                }}
              >
                <button
                  type="button"
                  className={styles.modifiableHighlightLabel}
                  style={{ top: labelPos.top, left: labelPos.left, cursor: "pointer" }}
                  title={`Mention #${id} in the chat`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(false);
                    window.dispatchEvent(
                      new CustomEvent("faraday:mention", { detail: { id } }),
                    );
                  }}
                >
                  #{id}
                </button>
              </div>
            );
          })}
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 2147483646 }}
          >
            <ChatPanel onClose={onClose} />
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

function rectsOverlap(
  a: { top: number; left: number; right: number; bottom: number },
  b: { top: number; left: number; right: number; bottom: number },
): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * Choose a corner of `highlight` to anchor the `#id` label to such that it
 * doesn't overlap the chat panel or the floating dot. Returns `{top, left}`
 * relative to the highlight box (which is the label's positioned ancestor).
 * Falls back to the top-left corner.
 */
function pickLabelPosition(
  id: string,
  highlight: DOMRect,
  panel: DOMRect | null,
  dot: { top: number; left: number } | null,
): { top: number; left: number } {
  const labelW = id.length * 6.5 + 16;
  const labelH = 16;
  const offset = 6;
  const yOffset = 10;

  // The highlight is positioned at (highlight.left - 2, highlight.top - 2) with
  // dimensions (highlight.width + 4, highlight.height + 4). The label uses
  // position: absolute relative to that box.
  const boxW = highlight.width + 4;
  const boxH = highlight.height + 4;

  const candidates: Array<{
    relative: { top: number; left: number };
    viewport: { top: number; left: number; right: number; bottom: number };
  }> = [
    // top-left
    {
      relative: { top: -yOffset, left: offset },
      viewport: {
        left: highlight.left + offset,
        right: highlight.left + offset + labelW,
        top: highlight.top - yOffset,
        bottom: highlight.top - yOffset + labelH,
      },
    },
    // top-right
    {
      relative: { top: -yOffset, left: boxW - offset - labelW - 4 },
      viewport: {
        right: highlight.right - offset,
        left: highlight.right - offset - labelW,
        top: highlight.top - yOffset,
        bottom: highlight.top - yOffset + labelH,
      },
    },
    // bottom-left
    {
      relative: { top: boxH - yOffset - 4, left: offset },
      viewport: {
        left: highlight.left + offset,
        right: highlight.left + offset + labelW,
        bottom: highlight.bottom + yOffset,
        top: highlight.bottom + yOffset - labelH,
      },
    },
    // bottom-right
    {
      relative: { top: boxH - yOffset - 4, left: boxW - offset - labelW - 4 },
      viewport: {
        right: highlight.right - offset,
        left: highlight.right - offset - labelW,
        bottom: highlight.bottom + yOffset,
        top: highlight.bottom + yOffset - labelH,
      },
    },
  ];

  const dotRect = dot
    ? { left: dot.left, top: dot.top, right: dot.left + 32, bottom: dot.top + 32 }
    : null;

  for (const c of candidates) {
    const collides =
      (panel && rectsOverlap(c.viewport, panel)) ||
      (dotRect && rectsOverlap(c.viewport, dotRect));
    if (!collides) return c.relative;
  }
  return candidates[0].relative;
}

