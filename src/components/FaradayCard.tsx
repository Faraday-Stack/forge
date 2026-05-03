const VARIANTS = {
  default:  { bg: "#ffffff", border: "#e5e7eb", shadow: "0 1px 6px rgba(0,0,0,0.08)" },
  outlined: { bg: "#ffffff", border: "#111827", shadow: "none" },
  filled:   { bg: "#f3f4f6", border: "#e5e7eb", shadow: "none" },
};

export interface FaradayCardProps {
  title?: string;
  body?: string;
  cta?: string;
  ctaHref?: string;
  variant?: keyof typeof VARIANTS;
}

export function FaradayCard({
  title,
  body,
  cta,
  ctaHref,
  variant = "default",
}: FaradayCardProps) {
  const v = VARIANTS[variant] ?? VARIANTS.default;

  return (
    <div
      style={{
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        boxShadow: v.shadow,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 14,
        lineHeight: 1.5,
        color: "#111827",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "8px 0",
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
      )}
      {body && (
        <div style={{ color: "#4b5563" }}>{body}</div>
      )}
      {cta && (
        <a
          href={ctaHref ?? "#"}
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "6px 14px",
            background: "#111827",
            color: "#fff",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            alignSelf: "flex-start",
          }}
        >
          {cta}
        </a>
      )}
    </div>
  );
}
