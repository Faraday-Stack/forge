import type { CSSProperties } from "react";

// Patterns that could be used for CSS injection attacks
const BLOCKED_PATTERNS = [
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /behavior\s*:/i,
  /-moz-binding/i,
];

export function sanitizeStyleValue(value: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(value)) return null;
  }
  return value;
}

export function sanitizeStyleProps(
  properties: Record<string, string>,
  allowedProps: string[],
): CSSProperties {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (!allowedProps.includes(k)) continue;
    const clean = sanitizeStyleValue(v);
    if (clean !== null) result[k] = clean;
  }
  return result as CSSProperties;
}
