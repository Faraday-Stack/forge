import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useFloating,
  offset,
  shift,
  flip,
  type Placement,
} from "@floating-ui/react";
import { ChatPanel } from "./ChatPanel";
import styles from "./widget.module.css";

type Position = "bottom-right" | "bottom-left" | "top-right" | "top-left";

interface UIAgentLauncherProps {
  position?: Position;
}

const POSITION_STYLE: Record<Position, React.CSSProperties> = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left":  { bottom: 20, left: 20 },
  "top-right":    { top: 20, right: 20 },
  "top-left":     { top: 20, left: 20 },
};

const POSITION_PLACEMENT: Record<Position, Placement> = {
  "bottom-right": "top-end",
  "bottom-left":  "top-start",
  "top-right":    "bottom-end",
  "top-left":     "bottom-start",
};

export function UIAgentLauncher({ position = "bottom-right" }: UIAgentLauncherProps) {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles } = useFloating({
    placement: POSITION_PLACEMENT[position],
    middleware: [offset(12), shift({ padding: 16 }), flip()],
    open,
  });

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const launcherStyle: React.CSSProperties = {
    ...POSITION_STYLE[position],
  };

  return createPortal(
    <div data-faraday>
      <button
        ref={refs.setReference}
        type="button"
        className={styles.launcher}
        style={launcherStyle}
        onClick={toggle}
        aria-label={open ? "Close UI Agent" : "Open UI Agent"}
        aria-expanded={open}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {open && (
        <div ref={refs.setFloating} style={floatingStyles}>
          <ChatPanel onClose={close} />
        </div>
      )}
    </div>,
    document.body
  );
}
