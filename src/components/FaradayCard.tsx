const VARIANTS = {
  default:  { borderWidth: 1, opacity: 1, fill: false },
  outlined: { borderWidth: 1.5, opacity: 1, fill: false },
  filled:   { borderWidth: 1, opacity: 1, fill: true },
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
        background: v.fill ? "rgb(from currentColor r g b / 0.04)" : "transparent",
        border: `${v.borderWidth}px solid currentColor`,
        borderRadius: 8,
        padding: "16px 20px",
        font: "inherit",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        margin: "8px 0",
        opacity: 0.95,
      }}
    >
      {title && (
        <div style={{ fontWeight: 600, fontSize: "1.05em" }}>{title}</div>
      )}
      {body && (
        <div style={{ opacity: 0.75 }}>{body}</div>
      )}
      {cta && (
        <a
          href={ctaHref ?? "#"}
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "6px 14px",
            border: "1px solid currentColor",
            borderRadius: 6,
            fontSize: "0.92em",
            fontWeight: 500,
            textDecoration: "none",
            color: "inherit",
            alignSelf: "flex-start",
          }}
        >
          {cta}
        </a>
      )}
    </div>
  );
}
