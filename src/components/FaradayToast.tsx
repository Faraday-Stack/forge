import { useState, useEffect } from "react";

const ACCENT = {
  info:    "#3b82f6",
  warning: "#f59e0b",
  error:   "#ef4444",
  success: "#22c55e",
};

export interface FaradayToastProps {
  message: string;
  title?: string;
  variant?: keyof typeof ACCENT;
  /** Auto-dismiss after N ms. Pass 0 for persistent. Default: 4000 */
  duration?: number;
}

export function FaradayToast({
  message,
  title,
  variant = "info",
  duration = 4000,
}: FaradayToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration === 0) return;
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  const accent = ACCENT[variant] ?? ACCENT.info;

  return (
    <div
      style={{
        background: "var(--background, #ffffff)",
        border: "1px solid currentColor",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: "12px 14px",
        minWidth: 280,
        maxWidth: 360,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        font: "inherit",
        color: "inherit",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        )}
        <div style={{ opacity: 0.85 }}>{message}</div>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          opacity: 0.5,
          padding: 0,
          font: "inherit",
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
