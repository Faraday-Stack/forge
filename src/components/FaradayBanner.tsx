import { useState } from "react";

const PALETTE = {
  info:    { bg: "#eff6ff", border: "#bfdbfe", icon: "ℹ", color: "#1e40af" },
  warning: { bg: "#fffbeb", border: "#fde68a", icon: "⚠", color: "#92400e" },
  error:   { bg: "#fef2f2", border: "#fecaca", icon: "✕", color: "#991b1b" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", icon: "✓", color: "#166534" },
};

export interface FaradayBannerProps {
  message: string;
  title?: string;
  variant?: keyof typeof PALETTE;
  dismissible?: boolean;
}

export function FaradayBanner({
  message,
  title,
  variant = "info",
  dismissible = false,
}: FaradayBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const c = PALETTE[variant] ?? PALETTE.info;

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        color: c.color,
        margin: "8px 0",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{c.icon}</span>
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        )}
        <div>{message}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: c.color,
            opacity: 0.6,
            padding: 0,
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
