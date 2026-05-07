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
 * Normalize and validate a CSS custom-property name. Accepts names with or
 * without the leading `--` and returns the canonical `--name` form, or `null`
 * if the name is malformed. CSS custom properties allow letters, digits,
 * underscores, and hyphens; we forbid whitespace and any characters that could
 * close out a `style` attribute or selector.
 */
export function sanitizeCssVarName(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/^--/, "");
  if (!trimmed) return null;
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(trimmed)) return null;
  return `--${trimmed}`;
}

const URL_BEARING_ATTRS = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "xlink:href",
  "poster",
  "background",
  "ping",
]);

const DANGEROUS_URL_PREFIXES = [
  /^\s*javascript:/i,
  /^\s*data:text\/html/i,
  /^\s*vbscript:/i,
];

const ALWAYS_BLOCKED_ATTRS = new Set([
  "id", // would re-key the registry
  "style", // applyStyle's job
  "class", // high-leverage for theme attacks; off by default
  "srcdoc", // arbitrary HTML in iframes
  "sandbox", // dropping it weakens iframe isolation
]);

/**
 * Validate an attribute name against the allowlist. Names with a `*` suffix in
 * the allowlist match any attr with that prefix (e.g. `"aria-*"` matches `"aria-label"`).
 * `on*` (event handlers) and the always-blocked set return false unconditionally.
 */
export function isAttributeAllowed(name: string, allowlist: string[]): boolean {
  const lower = name.toLowerCase();
  if (ALWAYS_BLOCKED_ATTRS.has(lower)) return false;
  if (lower.startsWith("on")) return false;
  for (const pattern of allowlist) {
    const p = pattern.toLowerCase();
    if (p.endsWith("*")) {
      if (lower.startsWith(p.slice(0, -1))) return true;
    } else if (p === lower) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize an attribute map for `setAttributes`. Drops disallowed keys silently;
 * empty-string values are normalized to `null` (clear). URL-bearing attrs reject
 * `javascript:`, `vbscript:`, and `data:text/html` payloads.
 */
export function sanitizeAttributes(
  attrs: Record<string, string>,
  allowlist: string[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(attrs)) {
    const lower = k.toLowerCase();
    if (!isAttributeAllowed(lower, allowlist)) continue;
    if (v === "" || v == null) {
      out[lower] = null;
      continue;
    }
    if (typeof v !== "string") continue;
    if (URL_BEARING_ATTRS.has(lower)) {
      if (DANGEROUS_URL_PREFIXES.some((re) => re.test(v))) continue;
    }
    out[lower] = v;
  }
  return out;
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
  html = html.replace(
    /(href|src|xlink:href)\s*=\s*"\s*javascript:[^"]*"/gi,
    "",
  );
  html = html.replace(
    /(href|src|xlink:href)\s*=\s*'\s*javascript:[^']*'/gi,
    "",
  );
  return html.trim();
}
