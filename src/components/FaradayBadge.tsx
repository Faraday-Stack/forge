const VARIANTS = {
  primary:   { bg: "#111827", color: "#fff" },
  secondary: { bg: "#f3f4f6", color: "#374151" },
  success:   { bg: "#dcfce7", color: "#166534" },
  warning:   { bg: "#fef9c3", color: "#854d0e" },
  error:     { bg: "#fee2e2", color: "#991b1b" },
};

export interface FaradayBadgeProps {
  label: string;
  variant?: keyof typeof VARIANTS;
}

export function FaradayBadge({ label, variant = "secondary" }: FaradayBadgeProps) {
  const v = VARIANTS[variant] ?? VARIANTS.secondary;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        lineHeight: 1.5,
        background: v.bg,
        color: v.color,
      }}
    >
      {label}
    </span>
  );
}
