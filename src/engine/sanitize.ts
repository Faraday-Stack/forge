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

/**
 * Strip dangerous patterns from agent-provided HTML markup before it's
 * rendered via dangerouslySetInnerHTML. This is a small, deliberately strict
 * allowlist — the agent should be writing inline SVG / static markup, never
 * scripts or event handlers.
 *
 * Removes: <script>...</script>, <iframe>, <object>, <embed>, on* attributes,
 * javascript: URLs in href/src, and form submissions.
 */
export function sanitizeHtmlMarkup(input: string): string {
  if (typeof input !== "string") return "";
  let html = input;
  // Drop obvious script/embed tags and their contents.
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  html = html.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  html = html.replace(/<embed\b[^>]*>/gi, "");
  html = html.replace(/<form\b[\s\S]*?<\/form>/gi, "");
  // Strip on* event handler attributes.
  html = html.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");
  // Strip javascript: in any attribute.
  html = html.replace(/(href|src|xlink:href)\s*=\s*"\s*javascript:[^"]*"/gi, "");
  html = html.replace(/(href|src|xlink:href)\s*=\s*'\s*javascript:[^']*'/gi, "");
  return html.trim();
}
