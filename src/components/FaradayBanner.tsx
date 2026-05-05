import { useState } from "react";

const ACCENT = {
  info:    "#3b82f6",
  warning: "#f59e0b",
  error:   "#ef4444",
  success: "#22c55e",
};

export interface FaradayBannerProps {
  message: string;
  title?: string;
  variant?: keyof typeof ACCENT;
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

  const accent = ACCENT[variant] ?? ACCENT.info;

  return (
    <div
      style={{
        background: "transparent",
        border: "1px solid currentColor",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: "10px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        font: "inherit",
        color: "inherit",
        margin: "8px 0",
        opacity: 0.95,
      }}
    >
      <div style={{ flex: 1 }}>
        {title && (
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        )}
        <div style={{ opacity: 0.85 }}>{message}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            opacity: 0.5,
            padding: 0,
            font: "inherit",
            lineHeight: 1,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
