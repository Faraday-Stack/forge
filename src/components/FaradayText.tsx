export interface FaradayTextProps {
  text: string;
  as?: "p" | "h1" | "h2" | "h3" | "h4" | "span";
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
}

export function FaradayText({
  text,
  as: Tag = "p",
  color,
  fontSize,
  fontWeight,
  textAlign,
}: FaradayTextProps) {
  return (
    <Tag
      style={{
        margin: 0,
        font: "inherit",
        color: color ?? "inherit",
        ...(fontSize && { fontSize }),
        ...(fontWeight && { fontWeight }),
        ...(textAlign && { textAlign }),
      }}
    >
      {text}
    </Tag>
  );
}
