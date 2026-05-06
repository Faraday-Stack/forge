const ACCENT: Record<string, string> = {
  primary: "currentColor",
  secondary: "currentColor",
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
};

export interface FaradayBadgeProps {
  label: string;
  variant?: keyof typeof ACCENT;
}

export function FaradayBadge({
  label,
  variant = "secondary",
}: FaradayBadgeProps) {
  const accent = ACCENT[variant] ?? ACCENT.secondary;
  const isMuted = variant === "secondary";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: "0.85em",
        fontWeight: 500,
        font: "inherit",
        lineHeight: 1.5,
        border: `1px solid ${accent}`,
        background: "transparent",
        color: accent === "currentColor" ? "inherit" : accent,
        opacity: isMuted ? 0.7 : 1,
      }}
    >
      {label}
    </span>
  );
}
