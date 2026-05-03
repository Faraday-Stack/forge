import { useState, useEffect } from "react";

const PALETTE = {
  info:    { bg: "#1e293b", border: "#334155", color: "#e2e8f0", accent: "#60a5fa" },
  warning: { bg: "#78350f", border: "#92400e", color: "#fef3c7", accent: "#fbbf24" },
  error:   { bg: "#7f1d1d", border: "#991b1b", color: "#fee2e2", accent: "#f87171" },
  success: { bg: "#14532d", border: "#166534", color: "#dcfce7", accent: "#4ade80" },
};

export interface FaradayToastProps {
  message: string;
  title?: string;
  variant?: keyof typeof PALETTE;
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

  const c = PALETTE[variant] ?? PALETTE.info;

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 280,
        maxWidth: 360,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        color: c.color,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 4,
          borderRadius: 2,
          background: c.accent,
          alignSelf: "stretch",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 2, color: "#fff" }}>{title}</div>
        )}
        <div>{message}</div>
      </div>
      <button
        onClick={() => setVisible(false)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: c.color,
          opacity: 0.5,
          padding: 0,
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
