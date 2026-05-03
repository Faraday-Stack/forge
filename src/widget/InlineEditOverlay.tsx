import { useState, useEffect, useCallback, useRef } from "react";
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
  const [collapsed, setCollapsed] = useState(true);
  const [dotPos, setDotPos] = useState<{ top: number; left: number } | null>(null);
  const [allRects, setAllRects] = useState<Record<string, DOMRect>>({});
  const dotRef = useRef<HTMLButtonElement | null>(null);

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

  if (!dotPos) return null;

  return createPortal(
    <div data-faraday>
      <button
        ref={setDotRef}
        type="button"
        className={styles.floatingExpandBtn}
        style={{ top: dotPos.top, left: dotPos.left }}
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Open Faraday editor" : "Close Faraday editor"}
        aria-expanded={!collapsed}
        title="Open Faraday editor"
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
          {Object.entries(allRects).map(([id, rect]) => (
            <div key={id} className={styles.modifiableHighlight} style={{
              position: "fixed",
              top: rect.top - 2,
              left: rect.left - 2,
              width: rect.width + 4,
              height: rect.height + 4,
            }}>
              <span className={styles.modifiableHighlightLabel}>#{id}</span>
            </div>
          ))}
          <div ref={refs.setFloating} style={floatingStyles}>
            <ChatPanel onClose={onClose} />
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
