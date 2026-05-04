import type { CSSProperties } from "react";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const fieldStyles: Record<string, CSSProperties> = {
  row: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    margin: "8px 0",
    fontFamily: FONT,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  requiredMark: {
    color: "#dc2626",
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
    background: "#ffffff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    color: "#111827",
    background: "#ffffff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 80,
  },
  inlineRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "8px 0",
    fontFamily: FONT,
    fontSize: 14,
    color: "#111827",
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    margin: "8px 0",
    fontFamily: FONT,
  },
  radioOption: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "#111827",
  },
};
